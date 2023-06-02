import { redirect } from 'next/navigation'
import WaitAndRedirect from './wait-and-redirect'
import { RedirectType } from 'next/dist/client/components/redirect'
import searchParam, { SearchParamProps } from '@/util/search-param'
import { RiErrorWarningLine } from 'react-icons/ri'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Please Wait...',
  description: "We're redirecting you to the checkout page",
}

export default function CheckoutCallback(props: SearchParamProps) {
  const rid = searchParam('rid', props)
  const error = searchParam('error', props)
  const continueTo = searchParam('continueTo', props)

  if (!rid && !error) {
    redirect('/checkout-callback?error=Invalid state provided', RedirectType.replace)
  }

  return (
    <main className="flex flex-1 flex-col items-center pt-24 pb-16">
      {error ? (
        <div className="flex items-start alert alert-error max-w-lg">
          <RiErrorWarningLine className="w-10 h-6" />
          <span>Checkout error: {error}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-row px-8 py-6 border-2 rounded-2xl border-accent border-dashed max-w-lg">
            <h2 className="text-base px-1 font-bold">Please wait while we redirect you</h2>
            <span className="loading loading-dots ml-2"></span>
          </div>
          <WaitAndRedirect rid={rid!} continueTo={continueTo} />
        </>
      )}
    </main>
  )
}
