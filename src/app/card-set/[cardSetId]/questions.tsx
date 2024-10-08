'use client'

import type { AppRouter } from '@/server/routers/app'
import type { inferProcedureOutput } from '@trpc/server'
import { trpc } from '@/requests/trpc'
import clsx from 'clsx'
import { formatMoney } from 'accounting'
import { compact, filter, isNil, map, values } from 'lodash'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import useLocalStorage from 'use-local-storage'
import {
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiArrowUpSLine,
  RiCheckFill,
  RiExternalLinkFill,
} from 'react-icons/ri'
import { Balancer } from 'react-wrap-balancer'
import useBoolean from '@/hooks/use-boolean'
import type { UserSession } from '@/app/get-server-session'
import Modal from '@/components/modal'

type Props = {
  retake?: string
  cardSetId: string
  user: UserSession | null
}

type FormData = {
  answers: Record<string, string | null>
}

type QuestionProps = inferProcedureOutput<AppRouter['cardSet']['findOne']>['questions'][number] & {
  isVisible: boolean
  isUnlocking: boolean
  index: number
  onNext: () => void
}

type FormProps = {
  cardSetId: string
  isSubmitting: boolean
  errorMessage?: string
  questions: inferProcedureOutput<AppRouter['cardSet']['findOne']>['questions']
  onSubmit: (data: FormData) => void
  onShowPurchaseModal: () => void
  refetch: () => Promise<void>
}

if (!process.env.NEXT_PUBLIC_PRICE_ID) {
  throw new Error('Please provide NEXT_PUBLIC_PRICE_ID env variable')
}

const priceId = process.env.NEXT_PUBLIC_PRICE_ID

function Question(props: QuestionProps) {
  const { isVisible, isUnlocking, index, id, text, options, onNext } = props
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const { register, watch } = useFormContext()

  const value = watch(`answers[${id}]`)
  const hasSelection = !isNil(value)

  const handleChange = useCallback(() => {
    // if we didn't have a selection before, trigger onNext
    if (!hasSelection) {
      setTimeout(onNext, 300)
    }
  }, [hasSelection, onNext])

  return (
    <div className={clsx(!isVisible && 'hidden', 'flex flex-col max-w-3xl')}>
      <div className="flex flex-row space-x-2 mb-8">
        <span className="text-2xl flex items-center place-self-start py-2 w-16">
          {index + 1}
          <RiArrowRightLine className="ml-2" />
        </span>
        <h3 className="text-5xl font-bold">
          <Balancer>{text}</Balancer>
        </h3>
      </div>
      <div className="w-auto min-w-96 flex flex-col place-self-start space-y-1 pl-20">
        {options.map((option, index) => (
          <div
            key={option.id}
            className={clsx(
              'form-control bg-base-200 hover:bg-base-300 rounded-2xl border border-gray-600 hover:border-gray-700 transition-all duration-200 ease-in-out',
              value === option.id ? 'border-gray-300 hover:border-gray-300' : null,
            )}
          >
            <label className="label cursor-pointer py-2 px-4 flex ">
              <input
                className="hidden"
                type="radio"
                disabled={isUnlocking}
                value={option.id}
                {...register(`answers[${id}]`, { onChange: handleChange })}
              />
              <span
                className={clsx(
                  'flex items-center mb-auto justify-center min-w-8 w-8 h-8 bg-gray-700 rounded-lg -ml-1 transition-all duration-200 ease-in-out',
                  value === option.id ? '!bg-gray-300 text-gray-800' : null,
                )}
              >
                {alphabet[index]}
              </span>
              <span className="label-text text-lg w-full px-4">{option.text}</span>
              <RiCheckFill
                className={clsx(
                  'w-6 h-6 opacity-0 transition-all duration-200',
                  value === option.id ? 'opacity-100' : null,
                )}
              />
            </label>
          </div>
        ))}
      </div>
      {hasSelection ? (
        <button
          onClick={onNext}
          type="button"
          disabled={isUnlocking}
          className="btn btn-primary btn-sm ml-20 mt-8 place-self-start"
        >
          {isUnlocking ? (
            <span className="loading loading-spinner" />
          ) : (
            <>
              Ok <RiCheckFill className={clsx('w-6 h-6')} />
            </>
          )}
        </button>
      ) : null}
    </div>
  )
}

function Form(props: FormProps) {
  const {
    cardSetId,
    isSubmitting,
    errorMessage,
    questions,
    onSubmit,
    onShowPurchaseModal,
    refetch,
  } = props

  const methods = useForm<FormData>()
  const { watch, handleSubmit } = methods

  const [currentQuestion_, setCurrentQuestion] = useState(0)
  const [isComplete, setComplete] = useBoolean(false)

  const currentQuestion = Math.min(questions.length || 0, currentQuestion_)

  const {
    mutate: unlock,
    isLoading: isUnlocking_,
    error: errorUnlocking,
  } = trpc.cardSet.unlock.useMutation({
    async onSuccess(result) {
      if (!result.success) {
        onShowPurchaseModal()
      } else {
        await refetch()
        setCurrentQuestion((prev) => prev + 1)
      }
    },
  })

  const isUnlocking = isUnlocking_ || Boolean(errorUnlocking)

  const handlePrevQuestion = useCallback(() => {
    setCurrentQuestion((prev) => prev - 1)
    setComplete.off()
  }, [setComplete])
  const handleNextQuestion = useCallback(() => {
    const nextQuestion = questions[currentQuestion + 1]
    if (nextQuestion && nextQuestion.isLocked) {
      unlock({ id: cardSetId })
    } else {
      setCurrentQuestion((prev) => prev + 1)
    }
  }, [cardSetId, currentQuestion, questions, unlock])

  const answered = watch(`answers`)

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col flex-1 items-start px-16 pt-6 pb-12"
      >
        <progress
          className={clsx(isComplete && 'hidden', 'progress progress-primary w-full mb-10')}
          value={(filter(answered, (answer) => Boolean(answer)).length / questions.length) * 100}
          max="100"
        />
        {questions.map((q, index) => (
          <Question
            key={q.id}
            index={index}
            isVisible={index === currentQuestion && !isComplete}
            isUnlocking={isUnlocking}
            onNext={index === questions.length - 1 ? setComplete.on : handleNextQuestion}
            {...q}
          />
        ))}
        <div
          className={clsx(!isComplete && 'hidden', 'flex flex-col flex-2/3 justify-center pl-20')}
        >
          <h3 className="text-5xl font-bold">
            <Balancer>Ready to get your result?</Balancer>
          </h3>
          <button
            disabled={isSubmitting}
            type="submit"
            className="btn btn-primary mt-8 place-self-start"
          >
            {isSubmitting ? <span className="loading loading-spinner" /> : 'Yes, show me my score!'}
          </button>
        </div>
      </form>
      <div className="join ml-36 mt-auto">
        <button
          disabled={isSubmitting || currentQuestion === 0}
          type="button"
          className="btn btn-neutral join-item btn-sm"
          onClick={handlePrevQuestion}
        >
          <RiArrowUpSLine className={clsx('w-6 h-6')} />
        </button>
        <button
          disabled={isSubmitting || currentQuestion === questions.length - 1}
          type="button"
          className="btn btn-neutral join-item btn-sm"
          onClick={handleNextQuestion}
        >
          <RiArrowDownSLine className="w-6 h-6" />
        </button>
      </div>
    </FormProvider>
  )
}

export default function Questions(props: Props) {
  const { cardSetId: cardSetId, user, retake } = props

  const router = useRouter()
  const [showPrices, setShowPrices] = useBoolean(false)

  const [submissionId, setSubmissionId] = useLocalStorage(
    'card-set:' + cardSetId + ':submission',
    '',
  )

  const {
    data: cardSet,
    isLoading,
    error,
    refetch,
  } = trpc.cardSet.findOne.useQuery({ id: cardSetId, submissionId })

  const {
    data: submission,
    mutate: submit,
    isLoading: isSubmitting_,
    error: errorSubmitting,
  } = trpc.cardSet.createSubmission.useMutation({
    onSuccess(submission) {
      if (submission.submissionId && !user) {
        setSubmissionId(submission.submissionId)
      }
      router.replace(`/card-set/${cardSetId}/submission/${submission.submissionId}`)
    },
  })

  const {
    mutateAsync: createCheckoutSession,
    isLoading: isCreatingCheckoutSession_,
    data: checkoutSessionData,
  } = trpc.billing.createCheckoutSession.useMutation()

  const isCreatingCheckoutSession = isCreatingCheckoutSession_ || Boolean(checkoutSessionData)

  const isSubmitting = isSubmitting_ || Boolean(submission)
  const purchasingTokens = cardSet ? Math.ceil(cardSet.requiredTokens / 5) * 5 : 0

  const handleSubmit = useCallback(
    (data: FormData) => {
      const answers = map(compact(values(data.answers)), (value) => ({ optionId: value! }))
      submit({ cardSetId, answers })
    },
    [cardSetId, submit],
  )

  const handleRefetch = useCallback(async () => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (cardSet?.submissionId && retake !== '1') {
      router.replace(`/card-set/${cardSet.id}/submission/${cardSet.submissionId}`)
    }
  }, [router, cardSet, retake])

  const handlePurchaseTokens = useCallback(async () => {
    const nextUrl = new URL(window.location.href)
    nextUrl.pathname = '/checkout-callback'
    nextUrl.search = '?continueTo=' + window.location.href

    const { url } = await createCheckoutSession({
      price: priceId,
      quantity: purchasingTokens,
      cancelUrl: window.location.href,
      nextUrl: nextUrl.href,
    })

    window.location.href = url
  }, [purchasingTokens, createCheckoutSession])

  return (
    <>
      <Modal isOpen={showPrices} onClose={setShowPrices.off} hideOnOutsideClick={false}>
        <div className="flex flex-col">
          <p className="text-sm pb-2">
            To proceed with the quiz, <span className="font-bold">purchase tokens now</span>. In
            case you&apos;re unsatisfied, you have a{' '}
            <span className="font-bold">24-hour window to request an automated refund</span>.
          </p>
          <p className="text-sm pb-2">
            We offer a full refund, excluding any Stripe processing fees. Rest assured, we strive to
            make the refund process seamless and hassle-free{' '}
            <span className="font-bold">without any questions asked</span>.
          </p>

          <div className="flex flex-col bg-base-300 rounded-2xl p-4 mt-4">
            <div className="flex flex-row justify-between">
              <div className="flex flex-col">
                <span className="text-xl font-bold">
                  {formatMoney(1.99 * (purchasingTokens / 5), 'USD $')}
                </span>
                <span className="text-gray-500 text-sm">For {purchasingTokens} tokens</span>
              </div>
              <button
                className="btn btn-primary w-1/2"
                disabled={isCreatingCheckoutSession}
                onClick={handlePurchaseTokens}
              >
                {isCreatingCheckoutSession ? (
                  <span className="loading loading-spinner" />
                ) : (
                  <>
                    Get Tokens Now <RiExternalLinkFill className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-2 -mb-2 place-self-end rounded-md">
              * we use Stripe for secure payment processing
            </p>
          </div>

          {!user ? (
            <>
              <div className="divider" />
              <p className="text-sm pb-2">
                Already have an account with purchased tokens? Click here to{' '}
                <Link className="link" href={'/login?continueTo=' + window.location.href}>
                  log in
                </Link>
                .
              </p>
            </>
          ) : null}
        </div>
      </Modal>
      <div className="navbar bg-base-100 py-4 px-6">
        <div className="flex-none">
          <Link href="/" replace className="group text-base font-bold">
            <RiArrowLeftLine className="inline-block mr-2 group-hover:mr-3 group-hover:-ml-1 w-4 h-4 -mt-1 transition-all" />
            <span>BACK</span>
          </Link>
        </div>
        <div className="flex-1 pl-12 pr-8 truncate text-2xl underline">{cardSet?.title}</div>
      </div>
      <div className="divider -mt-2"></div>
      {isLoading || error || (cardSet.submissionId && retake !== '1') ? (
        <span className="loading loading-spinner loading-lg place-self-center justify-self-center my-auto" />
      ) : (
        <Form
          cardSetId={cardSetId}
          isSubmitting={isSubmitting}
          errorMessage={errorSubmitting?.message}
          onSubmit={handleSubmit}
          onShowPurchaseModal={setShowPrices.on}
          refetch={handleRefetch}
          questions={cardSet.questions}
        />
      )}
    </>
  )
}
