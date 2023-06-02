import { router } from '../trpc'

import { authRouter } from './auth'
import { billingRouter } from './billing'
import { cardSetRouter } from './card-set'
import { uploadRouter } from './upload'

export const appRouter = router({
  auth: authRouter,
  billing: billingRouter,
  cardSet: cardSetRouter,
  upload: uploadRouter,
})

export type AppRouter = typeof appRouter
