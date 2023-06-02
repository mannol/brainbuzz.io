import { z } from 'zod'
import { GetDocumentTextDetectionCommand, TextractClient } from '@aws-sdk/client-textract'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import calculateRequiredTokens from '@/lib/calculate-required-tokens'

const inputSchema = z.object({
  JobId: z.string(),
  Status: z.enum(['IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'PARTIAL_SUCCESS']),
  API: z.enum(['StartDocumentTextDetection']),
  Timestamp: z.number(),
  DocumentLocation: z.object({
    S3ObjectName: z.string(),
    S3Bucket: z.string(),
  }),
})

export async function POST(request: NextRequest) {
  const input = inputSchema.safeParse(await request.json())

  if (!input.success) {
    console.error('Error parsing SNS input:', input.error.message)
    return NextResponse.json(
      { title: 'Bad Request', message: input.error.message },
      { status: 400 },
    )
  }

  const cardSet = await prisma.cardSet.findUnique({ where: { textractJobId: input.data.JobId } })

  if (!cardSet) {
    return NextResponse.json(
      { title: 'Internal Server Error', message: `Not ready to process this request` },
      { status: 500 },
    )
  }

  const client = new TextractClient({})

  if (input.data.Status !== 'SUCCEEDED') {
    const command: GetDocumentTextDetectionCommand = new GetDocumentTextDetectionCommand({
      JobId: input.data.JobId,
    })
    const response = await client.send(command)

    await prisma.cardSet.update({
      data: { error: 'Error processing PDF file: ' + response.StatusMessage },
      where: { id: cardSet.id },
    })

    console.error('Error processing PDF file: ' + response.StatusMessage)

    return NextResponse.json({ success: true })
  }

  let sourceText = ''
  for (let nextToken = undefined; ; ) {
    const command: GetDocumentTextDetectionCommand = new GetDocumentTextDetectionCommand({
      JobId: input.data.JobId,
      MaxResults: 1000,
      NextToken: nextToken,
    })
    const response = await client.send(command)

    for (const block of response.Blocks || []) {
      if (block.BlockType === 'LINE') {
        sourceText += block.Text + '\n'
      }
    }

    if (!(nextToken = response.NextToken)) {
      break
    }
  }

  const requiredTokens = calculateRequiredTokens(sourceText.length)

  await prisma.cardSet.update({ data: { sourceText, requiredTokens }, where: { id: cardSet.id } })
}
