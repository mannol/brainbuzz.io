import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { Client, Receiver } from '@upstash/qstash'
import { nanoid as defaultNanoId, customAlphabet } from 'nanoid'
import { attempt, isError } from 'lodash'
import { Configuration, CreateChatCompletionResponse, OpenAIApi } from 'openai'
import prisma from '@/lib/prisma'

if (
  !process.env.QSTASH_TOKEN ||
  !process.env.QSTASH_CURRENT_SIGNING_KEY ||
  !process.env.QSTASH_NEXT_SIGNING_KEY ||
  !process.env.OPENAI_API_KEY
) {
  throw new Error(
    'Please provide QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY and OPENAI_API_KEY env variables',
  )
}

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 8)

const upstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
})
const upstashClient = new Client({
  token: process.env.QSTASH_TOKEN,
})

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  }),
)

const inputSchema = z.object({
  url: z.string().url(),
  cardSetId: z.string(),
  iterator: z
    .object({
      lastIndex: z.number(),
      incompleteChunk: z.string(),
    })
    .optional(),
})

const outputSchema = z.object({
  d: z.array(
    z
      .object({
        q: z.string(),
        o: z.array(z.string()),
        a: z.number(),
      })
      .refine((data) => data.a >= 0 && data.a < data.o.length, {
        message: 'Answer index out of bounds',
        path: ['a'],
      }),
  ),
  ic: z.string().optional(),
})

async function recordErrorAndReturnTokens(cardSetId: string, errorMessage: string) {
  await prisma.$transaction([
    prisma.cardSet.update({ data: { error: errorMessage }, where: { id: cardSetId } }),
    prisma.token.updateMany({
      data: { redeemedAt: null, redeemedByCardSetId: null },
      where: { redeemedByCardSet: { id: cardSetId } },
    }),
  ])
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('upstash-signature')

  if (!signature) {
    return NextResponse.json(
      { title: 'Bad Request', message: 'Missing signature' },
      { status: 400 },
    )
  }

  try {
    await upstashReceiver.verify({
      body: rawBody,
      signature,
      clockTolerance: 60 * 5,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { title: 'Bad Request', message: 'Signature verification failed' },
      { status: 400 },
    )
  }

  const input = inputSchema.safeParse(JSON.parse(rawBody))
  if (!input.success) {
    return NextResponse.json(
      { title: 'Bad Request', message: input.error.message },
      { status: 400 },
    )
  }

  const cardSet = await prisma.cardSet.findUnique({ where: { id: input.data.cardSetId } })
  if (!cardSet) {
    return NextResponse.json(
      { title: 'Not Found', message: 'No such card set found' },
      { status: 404 },
    )
  }

  const text = cardSet.sourceText

  if (!text || cardSet.refundedAt || cardSet.error || cardSet.readyAt) {
    return NextResponse.json(
      { title: 'Bad Request', message: 'The card set cannot be processed at this time' },
      { status: 400 },
    )
  }

  // The chunking algorith works like this:
  // - If this is the beginning of the text, just select the chunk (of max 6144 characters; where prompt + chunk ~= 2000 TOK)
  // - If this is not the beginning of the text, select the chunk (of max 5120 characters) and add previous chunk (of 1024 characters)
  //   for context, as well as the previous question; where prompt + prevChunk + question + chunk ~= 2100 TOK

  const hasMore =
    text.length > (input.data.iterator ? input.data.iterator.lastIndex + 5 * 1024 : 6 * 1024)

  const chunk = input.data.iterator
    ? text.slice(input.data.iterator.lastIndex, input.data.iterator.lastIndex + 5 * 1024)
    : text.slice(0, 6 * 1024)

  const tag = nanoid()

  let prompt = `
    Your task is to help a student learn by creating short tests
    for them that will help them memorize and understand the topic.

    Write at least 3 or at most 6 multiple choice questions for
    the student based on the information provided in a part of the
    learning material delimited by an XML tag <${tag}></${tag}>.

    ${
      hasMore
        ? 'The learning material is too big to fit your context so only a chunk of it is provided.'
        : ''
    }

    Format the output as a minified RFC8259 compliant JSON response object
    with data array that contains the questions as follows, no talking:

    { 
      ${hasMore ? 'ic: <The last 50 (fifty) words of the learning material>,' : ''}
      d: [{
        q: <contains the text of the question formatted as a markdown
            with at most 320 characters>
        o: <array of possible answers, formatted as a string of text using
            markdown, with 3 or 4 items. It must contain the correct answer>
        a: <is a number representing the index of the correct answer in
            the array of options>
      }]
    }

    Learning material: <${tag}>${(input.data.iterator?.incompleteChunk || '') + chunk}</${tag}>
  `

  let completion: CreateChatCompletionResponse

  try {
    completion = await openai
      .createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      })
      .then((res) => res.data)
  } catch (err) {
    const errorMessage =
      (err as any)?.response?.data?.error?.message ||
      (err as any)?.message ||
      'Unknown error with openai request'

    if ((err as any)?.response?.status === 503) {
      console.warn('ChatGPT server too busy, retrying')
      await upstashClient.publishJSON({
        delay: 5,
        url: input.data.url,
        body: input.data,
      })
      return NextResponse.json({ success: true, delayed: true })
    }

    console.warn(JSON.stringify(err, null, 2))

    console.error(errorMessage)

    await recordErrorAndReturnTokens(
      cardSet.id,
      'ChatGPT processing error occured. Your tokens have been refunded; please try again later.',
    )

    return NextResponse.json(
      { title: 'Internal Server Error', message: errorMessage },
      { status: 500 },
    )
  }

  const content = completion.choices[0].message?.content

  const parsedOrError = content ? attempt(JSON.parse, content) : new Error('Missing response text')

  if (isError(parsedOrError)) {
    console.error(parsedOrError.message)
    console.error('Failed to parse:', content)
    return NextResponse.json(
      { title: 'Internal Server Error', message: parsedOrError.message },
      { status: 500 },
    )
  }

  const result = outputSchema.safeParse(parsedOrError)

  if (result.success) {
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < result.data.d.length; index++) {
        const question = result.data.d[index]
        await tx.question.create({
          data: {
            id: defaultNanoId(),
            text: question.q,
            cardSet: { connect: { id: cardSet.id } },
            index,
            options: {
              createMany: {
                data: question.o.map((option, optionIndex) => ({
                  id: defaultNanoId(),
                  text: option,
                  isCorrect: optionIndex === question.a,
                  index: optionIndex,
                })),
              },
            },
          },
        })
      }
    })

    if (hasMore) {
      try {
        await upstashClient.publishJSON({
          url: input.data.url,
          body: {
            url: input.data.url,
            cardSetId: cardSet.id,
            iterator: {
              lastIndex: input.data.iterator ? input.data.iterator.lastIndex + 5 * 1024 : 6 * 1024,
              incompleteChunk: result.data.ic || '',
            },
          },
        })
      } catch (err) {
        const errorMessage = (err as any)?.message || 'Unknown error with upstash request'

        console.error(errorMessage)

        await recordErrorAndReturnTokens(
          cardSet.id,
          'Something went wrong. Your tokens have been refunded; please try again later.',
        )

        return NextResponse.json(
          { title: 'Internal Server Error', message: errorMessage },
          { status: 500 },
        )
      }
    } else {
      await prisma.cardSet.update({ data: { readyAt: new Date() }, where: { id: cardSet.id } })
    }
  } else {
    console.error('Failed to process ChatGPT response: ' + result.error.message)
    console.error('Response:', parsedOrError)
    return NextResponse.json(
      { title: 'Failed to process ChatGPT response', message: result.error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
