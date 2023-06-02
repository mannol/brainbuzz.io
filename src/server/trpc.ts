import getServerSession from '@/app/get-server-session'
import { inferAsyncReturnType, initTRPC } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  const requestUrl = new URL(opts.req.url)
  requestUrl.host = opts.req.headers.get('x-forwarded-host')?.split(',')[0] || requestUrl.host
  requestUrl.protocol =
    opts.req.headers.get('x-forwarded-proto')?.split(',')[0] || requestUrl.protocol

  const user = await getServerSession()

  if (process.env.NODE_ENV === 'development' && requestUrl.host.includes('ngrok-free.app')) {
    requestUrl.port = ''
  }

  return {
    user,
    requestUrl,
  }
}

type ContextType = inferAsyncReturnType<typeof createContext>

const t = initTRPC.context<ContextType>().create()

export const router = t.router
export const procedure = t.procedure
