import { z } from 'zod'
import { TextractClient, StartDocumentTextDetectionCommand } from '@aws-sdk/client-textract'
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'
import prisma from '@/lib/prisma'
import calculateRequiredTokens from '@/lib/calculate-required-tokens'
import { CardSet, Submission } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { Client } from '@upstash/qstash'
import { format as formatUrl } from 'url'
import { extractRawText } from 'mammoth'
import { procedure, router } from '../trpc'

if (!process.env.QSTASH_TOKEN) {
  throw new Error('Please provide QSTASH_TOKEN env variable')
}

const upstashClient = new Client({
  token: process.env.QSTASH_TOKEN,
})

async function resolveCardSet(cardSet: CardSet, submission: Submission | null) {
  let status: 'READY' | 'ERROR' | 'PREPARING' | 'WAITING' | 'ANALYZING' | 'STARTING'

  if (cardSet.readyAt) {
    status = 'READY'
  } else if (cardSet.error) {
    status = 'ERROR'
  } else if (cardSet.prepareStartedAt) {
    status = 'PREPARING'
  } else if (cardSet.sourceText) {
    status = 'WAITING'
  } else if (cardSet.textractJobId) {
    status = 'ANALYZING'
  } else {
    status = 'STARTING'
  }

  const answers = submission
    ? await prisma.answer.findMany({
        select: { option: { select: { id: true, questionId: true } } },
        where: { submission: { id: submission.id } },
      })
    : []

  const questions =
    status === 'READY'
      ? await prisma.question.findMany({
          where: { cardSet: { id: cardSet.id } },
          select: {
            id: true,
            text: true,
            options: {
              select: {
                id: true,
                text: true,
                isCorrect: true,
              },
              orderBy: { index: 'asc' },
            },
          },
          orderBy: [{ createdAt: 'asc' }, { index: 'asc' }],
        })
      : []

  const isLocked = false
  // const isLocked = await prisma.token
  //   .count({
  //     where: { redeemedByCardSet: { id: cardSet.id }, payment: { refundedAt: null } },
  //   })
  //   .then((count) => count === 0)

  return {
    id: cardSet.id,
    status,
    createdAt: cardSet.createdAt,
    title: cardSet.title,
    requiredTokens: cardSet.requiredTokens,
    isLocked,
    error: cardSet.error,
    submissionId: submission?.id || null,
    questions: questions.map((question, index) => {
      const answer = answers.find((a) => a.option.questionId === question.id)
      const hideLocked = index >= 3 && isLocked

      return {
        id: question.id,
        text: hideLocked ? '[LOCKED]' : question.text,
        isLocked: hideLocked,
        options: question.options.map((o) => ({
          id: o.id,
          text: hideLocked ? '[LOCKED]' : o.text,
        })),
        answer: submission
          ? {
              userChoice: answer ? answer.option.id : null,
              correctChoice: question.options.find((o) => o.isCorrect)!.id,
            }
          : null,
      }
    }),
  }
}

export const cardSetRouter = router({
  findOne: procedure
    .input(
      z.object({
        id: z.string(),
        submissionId: z.string().optional(),
      }),
    )
    .query(async (opts) => {
      const user = opts.ctx.user
      const submissionId = opts.input.submissionId
      const cardSet = await prisma.cardSet.findUnique({ where: { id: opts.input.id } })

      if (!cardSet || cardSet.refundedAt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card set not found',
        })
      }

      const submission =
        user || submissionId
          ? await prisma.submission.findFirst({
              where: {
                ...(submissionId ? { id: submissionId } : { user: { id: user!.uid } }),
                answers: { some: { option: { question: { cardSet: { id: cardSet.id } } } } },
              },
              orderBy: { createdAt: 'desc' },
            })
          : null

      return resolveCardSet(cardSet, submission)
    }),
  findAll: procedure.query(async (opts) => {
    const user = opts.ctx.user

    if (!user) {
      return []
    }

    const cardSets: (CardSet & { submission?: Submission | null })[] =
      await prisma.cardSet.findMany({
        where: { createdByUser: { id: user.uid }, refundedAt: null, error: null },
        orderBy: { createdAt: 'desc' },
      })

    for (const cardSet of cardSets) {
      cardSet.submission = await prisma.submission.findFirst({
        where: {
          user: { id: user.uid },
          answers: { some: { option: { question: { cardSet: { id: cardSet.id } } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    return Promise.all(
      cardSets.map((cardSet) => resolveCardSet(cardSet, cardSet.submission || null)),
    )
  }),
  create: procedure
    .input(
      z.object({
        fileKey: z.string(),
        title: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const id = nanoid()
      const user = opts.ctx.user

      const s3Client = new S3Client({})
      const headObjectCommand = new HeadObjectCommand({
        Bucket: process.env.AWS_UPLOAD_BUCKET,
        Key: opts.input.fileKey,
      })
      const headObjectResponse = await s3Client.send(headObjectCommand)

      if (headObjectResponse.ContentType === 'application/pdf') {
        const textractClient = new TextractClient({})
        const textractCommand = new StartDocumentTextDetectionCommand({
          DocumentLocation: {
            S3Object: {
              Bucket: process.env.AWS_UPLOAD_BUCKET,
              Name: opts.input.fileKey,
            },
          },
          ClientRequestToken: opts.input.fileKey,
          NotificationChannel: {
            SNSTopicArn: process.env.AWS_SNS_TOPIC_ARN,
            RoleArn: process.env.AWS_ROLE_ARN,
          },
        })
        const textractResponse = await textractClient.send(textractCommand)

        const cardSet = await prisma.cardSet.create({
          data: {
            id,
            title: opts.input.title,
            createdByUser: user ? { connect: { id: user.uid } } : undefined,
            textractJobId: textractResponse.JobId,
          },
        })

        return resolveCardSet(cardSet, null)
      } else {
        const getObjectCommand = new GetObjectCommand({
          Bucket: process.env.AWS_UPLOAD_BUCKET,
          Key: opts.input.fileKey,
        })
        const getObjectResponse = await s3Client.send(getObjectCommand)
        const arrayBuffer = await getObjectResponse.Body?.transformToByteArray()

        if (!arrayBuffer) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unexpected return from AWS',
          })
        }

        const { value: sourceText } = await extractRawText({ buffer: Buffer.from(arrayBuffer) })
        const requiredTokens = calculateRequiredTokens(sourceText.length)

        const cardSet = await prisma.cardSet.create({
          data: {
            id,
            title: opts.input.title,
            createdByUser: user ? { connect: { id: user.uid } } : undefined,
            sourceText: sourceText,
            requiredTokens,
          },
        })

        return resolveCardSet(cardSet, null)
      }
    }),
  recreate: procedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const id = nanoid()
      const user = opts.ctx.user

      const originalCardSet = await prisma.cardSet.findFirst({
        where: {
          id: opts.input.id,
        },
      })

      if (!originalCardSet) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have the permissions to recreate this card set",
        })
      }

      const cardSet = await prisma.cardSet.create({
        data: {
          id,
          title: originalCardSet.title,
          createdByUser: user ? { connect: { id: user.uid } } : undefined,
          sourceText: originalCardSet.sourceText,
          requiredTokens: originalCardSet.requiredTokens,
        },
      })

      return resolveCardSet(cardSet, null)
    }),
  prepare: procedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const user = opts.ctx.user

      const cardSet = await prisma.cardSet.findFirst({
        where: {
          id: opts.input.id,
        },
      })

      if (
        !cardSet ||
        !cardSet.sourceText ||
        cardSet.prepareStartedAt ||
        cardSet.readyAt ||
        cardSet.error
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This card set cannot be prepared',
        })
      }

      return prisma.$transaction(
        async (tx) => {
          const availableTokens = user
            ? await tx.token.findMany({
                select: { id: true },
                where: {
                  redeemedAt: null,
                  payment: { user: { id: user.uid }, refundedAt: null },
                },
                take: cardSet.requiredTokens,
              })
            : []

          await tx.cardSet.update({
            data: {
              prepareStartedAt: new Date(),
              createdByUser: user ? { connect: { id: user.uid } } : undefined,
            },
            where: { id: cardSet.id },
          })

          // Already have tokens, redeem immediatelly
          if (availableTokens.length >= cardSet.requiredTokens) {
            await tx.token.updateMany({
              data: { redeemedAt: new Date(), redeemedByCardSetId: cardSet.id },
              where: { id: { in: availableTokens.map((t) => t.id) } },
            })
          }

          const requestUrl = new URL(opts.ctx.requestUrl)

          const url = formatUrl({
            host: requestUrl.host,
            protocol: requestUrl.protocol,
            pathname: '/api/webhooks/question-builder-callback',
          })

          await upstashClient.publishJSON({
            url,
            body: {
              url,
              cardSetId: cardSet.id,
            },
          })

          return {
            success: true,
            usedTokens: availableTokens.length,
          }
        },
        {
          maxWait: 4000,
          timeout: 10000,
        },
      )
    }),
  createSubmission: procedure
    .input(
      z.object({
        cardSetId: z.string(),
        answers: z.array(z.object({ optionId: z.string() })),
      }),
    )
    .mutation(async (opts) => {
      const user = opts.ctx.user

      const cardSet = await prisma.cardSet.findUnique({
        where: { id: opts.input.cardSetId },
        include: { questions: { select: { options: { select: { id: true } } } } },
      })

      if (!cardSet || cardSet.refundedAt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card set not found',
        })
      }

      const availableOptions = cardSet.questions.flatMap((q) => q.options).flatMap((o) => o.id)
      for (const { optionId } of opts.input.answers) {
        if (!availableOptions.includes(optionId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid options id provided: ' + optionId,
          })
        }
      }

      const id = nanoid()

      const submission = await prisma.submission.create({
        data: {
          id,
          user: user ? { connect: { id: user.uid } } : undefined,
          answers: { createMany: { data: opts.input.answers } },
        },
      })

      return resolveCardSet(cardSet, submission)
    }),
  unlock: procedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const user = opts.ctx.user

      const cardSet = await prisma.cardSet.findFirst({
        where: {
          id: opts.input.id,
        },
        include: {
          redeemedTokens: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!cardSet || (cardSet.createdByUserId && cardSet.createdByUserId !== user?.uid)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have the permissions to unlock this card set",
        })
      }

      if (cardSet.redeemedTokens.length === cardSet.requiredTokens) {
        return {
          success: true,
          usedTokens: 0,
        }
      }

      if (!user) {
        return {
          success: false,
          requiredTokens: cardSet.requiredTokens,
        }
      }

      return prisma.$transaction(
        async (tx) => {
          const availableTokens = await tx.token.findMany({
            select: { id: true },
            where: {
              redeemedAt: null,
              payment: { user: { id: user.uid }, refundedAt: null },
            },
            take: cardSet.requiredTokens,
          })

          if (availableTokens.length < cardSet.requiredTokens) {
            return {
              success: false,
              requiredTokens: cardSet.requiredTokens - availableTokens.length,
            }
          }

          await tx.cardSet.update({
            data: {
              createdByUser: { connect: { id: user.uid } },
            },
            where: { id: cardSet.id },
          })

          await tx.token.updateMany({
            data: { redeemedAt: new Date(), redeemedByCardSetId: cardSet.id },
            where: { id: { in: availableTokens.map((t) => t.id) } },
          })

          return {
            success: true,
            usedTokens: availableTokens.length,
          }
        },
        {
          maxWait: 4000,
          timeout: 10000,
        },
      )
    }),
})
