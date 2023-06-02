import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { procedure, router } from '../trpc'

export const uploadRouter = router({
  createSignedUrl: procedure
    .input(
      z.object({
        contentType: z.string(),
      }),
    )
    .mutation(async (opts) => {
      if (
        ![
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ].includes(opts.input.contentType)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Document type is not supported',
        })
      }

      const key = nanoid()
      const client = new S3Client({})
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_UPLOAD_BUCKET,
        Key: key,
        ContentType: opts.input.contentType,
      })
      const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 })

      return {
        signedUrl,
        key,
      }
    }),
})
