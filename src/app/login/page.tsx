import Form from './form'
import searchParam, { SearchParamProps } from '@/util/search-param'
import { Metadata } from 'next'
import Balancer from 'react-wrap-balancer'

export const metadata: Metadata = {
  title: 'BrainBuzz - Login',
}

export default async function Login(props: SearchParamProps) {
  const error = searchParam('error', props)
  const checkEmail = searchParam('checkEmail', props)
  const email = searchParam('email', props)

  return (
    <main className="flex flex-1 flex-col items-center pt-24 pb-16">
      {checkEmail === '1' ? (
        <div className="flex flex-col px-8 py-6 border-2 rounded-2xl border-success border-dashed max-w-lg">
          <h2 className="text-base px-1 font-bold">
            {email ? (
              <Balancer ratio={0.2}>
                Great! We&apos;ve just sent an email to{' '}
                <span className="text-primary-content underline">{email}</span> containing a login
                link. Kindly click on it to verify and proceed.
              </Balancer>
            ) : (
              <Balancer>
                Great! We&apos;ve just sent you an email containing a login link. Kindly click on it
                to verify and proceed.
              </Balancer>
            )}
          </h2>
        </div>
      ) : (
        <Form error={error} email={email} />
      )}
    </main>
  )
}
