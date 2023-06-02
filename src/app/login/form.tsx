'use client'

import { RiArrowRightLine, RiErrorWarningLine } from 'react-icons/ri'
import useLoginMutation from '@/requests/use-login-mutation'
import { useForm } from 'react-hook-form'
import { unary } from 'lodash'
import clsx from 'clsx'
import { useEffect } from 'react'

type Props = {
  error?: string
  email?: string
}

export default function Form(props: Props) {
  const { error, email: defaultEmail } = props

  const { mutateAsync: login, isLoading: isLoading_, data } = useLoginMutation()
  const { handleSubmit, watch, register } = useForm<{ email: string }>({
    defaultValues: {
      email: defaultEmail,
    },
  })

  const isLoading = isLoading_ || Boolean(data)
  const email = watch('email')

  useEffect(() => {
    if (defaultEmail && !error) {
      login({ email: defaultEmail })
    }
  }, [defaultEmail, error, login])

  return (
    <div className="flex flex-col w-full max-w-md">
      <form
        onSubmit={handleSubmit(unary(login))}
        className={clsx(
          'flex flex-col px-8 pt-6 pb-8 border-2 rounded-2xl border-gray-600 border-dashed',
          error && 'border-error',
        )}
      >
        <h2 className="text-2xl px-1 font-bold mb-6">Welcome back! Please enter your email:</h2>
        <div className="join flex w-full">
          <input
            {...register('email', { required: true })}
            type="email"
            placeholder="Email address"
            className="flex-1 input input-bordered join-item"
            disabled={isLoading}
          />
          <button disabled={isLoading || !email} className="btn btn-primary join-item">
            {isLoading ? (
              <span className="loading loading-spinner" />
            ) : (
              <>
                Login <RiArrowRightLine />
              </>
            )}
          </button>
        </div>
      </form>
      {error ? (
        <div className="flex items-start alert alert-error mt-8 ">
          <RiErrorWarningLine className="w-10 h-6" />
          <span>Error: {error}</span>
        </div>
      ) : null}
    </div>
  )
}
