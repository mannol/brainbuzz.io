import { redirect } from 'next/navigation'
import CreateSession from './create-session'
import { RedirectType } from 'next/dist/client/components/redirect'
import searchParam, { SearchParamProps } from '@/util/search-param'
import { RiErrorWarningLine } from 'react-icons/ri'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Please Wait...',
  description: "We're logging you in.",
}

export default function LoginCallback(props: SearchParamProps) {
  const email = searchParam('email', props)
  const error = searchParam('error', props)
  const continueTo = searchParam('continueTo', props)

  if (!email && !error) {
    redirect('/login-callback?error=No email state provided', RedirectType.replace)
  }

  return (
    <main className="flex flex-1 flex-col items-center pt-24 pb-16">
      {error ? (
        <div className="flex items-start alert alert-error max-w-lg">
          <RiErrorWarningLine className="w-10 h-6" />
          <span>Login error: {error}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-row px-8 py-6 border-2 rounded-2xl border-accent border-dashed max-w-lg">
            <h2 className="text-base px-1 font-bold">Please wait while we redirect you</h2>
            <span className="loading loading-dots ml-2"></span>
          </div>
          <CreateSession email={email!} continueTo={continueTo} />
        </>
      )}
    </main>
  )
}
