import '@/app/firebase-admin'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { getAuth } from 'firebase-admin/auth'
import { TRPCError } from '@trpc/server'
import { procedure, router } from '../trpc'
import prisma from '@/lib/prisma'

export const authRouter = router({
  createSession: procedure
    .input(
      z.object({
        idToken: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const decodedIdToken = await getAuth().verifyIdToken(opts.input.idToken)

      // Only allow setting this if the login happened within the last hour
      if (!(new Date().getTime() / 1000 - decodedIdToken.auth_time < 60 * 60)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Please login again',
        })
      }

      const expiresIn = 60 * 60 * 24 * 14 // 2 weeks

      const cookie = await getAuth().createSessionCookie(opts.input.idToken, {
        expiresIn: expiresIn * 1000,
      })

      await prisma.user.upsert({
        create: { id: decodedIdToken.uid },
        update: { id: decodedIdToken.uid },
        where: { id: decodedIdToken.uid },
      })

      const cookieStore = cookies()

      cookieStore.set('session', cookie, {
        httpOnly: true,
        path: '/',
        maxAge: expiresIn,
        secure: process.env.NODE_ENV === 'production',
      })

      return {
        idToken: opts.input.idToken,
        expiresIn,
      }
    }),
  logout: procedure.mutation(() => {
    const cookieStore = cookies()

    const sessionCookie = cookieStore.get('session')

    if (!sessionCookie) {
      return { success: true }
    }

    cookieStore.delete({
      ...sessionCookie,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })

    return { success: true }
  }),
})
