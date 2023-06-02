'use client'

import type { AppRouter } from '@/server/routers/app'
import type { inferProcedureOutput } from '@trpc/server'
import { trpc } from '@/requests/trpc'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useCallback, useEffect } from 'react'
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckFill,
  RiCloseFill,
  RiMailLine,
} from 'react-icons/ri'
import { Balancer } from 'react-wrap-balancer'

type Props = {
  cardSetId: string
  submissionId: string
}

type QuestionProps = inferProcedureOutput<AppRouter['cardSet']['findOne']>['questions'][number] & {
  index: number
}

type OptionProps = QuestionProps['options'][number] & {
  index: number
  isCorrect: boolean
  isError: boolean
}

function Option(props: OptionProps) {
  const { index, text, isCorrect, isError } = props
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  return (
    <div
      className={clsx('form-control bg-base-200 rounded-2xl border border-gray-600', {
        '!text-success !border-success': isCorrect,
        '!text-error !border-error': isError,
      })}
    >
      <label className="label py-2 px-4 flex">
        <input className="hidden" type="radio" />
        <span
          className={clsx(
            'flex items-center justify-center min-w-8 w-8 h-8 rounded-lg -ml-1 bg-gray-700',
            {
              '!bg-green-500 text-gray-900': isCorrect,
              '!bg-red-500 text-gray-900': isError,
            },
          )}
        >
          {alphabet[index]}
        </span>
        <span className="text-lg w-full px-4">{text}</span>
        {isCorrect ? (
          <RiCheckFill className="w-6 h-6" />
        ) : isError ? (
          <RiCloseFill className="w-6 h-6" />
        ) : null}
      </label>
    </div>
  )
}

function Question(props: QuestionProps) {
  const { index, text, options, answer } = props

  if (!answer) {
    // Shouldn't happen ever
    return null
  }

  const userOption = answer.userChoice ? options.find((o) => o.id === answer.userChoice) : null
  const correctOption = options.find((o) => o.id === answer.correctChoice)

  if (!correctOption) {
    // Shouldn't happen ever
    return null
  }

  const guessedCorrectly = Boolean(userOption && userOption.id === correctOption.id)

  return (
    <div className="flex flex-col max-w-3xl">
      <div className="flex flex-row space-x-2 mb-4">
        <span className="text-lg flex items-center place-self-start py-2 w-16">
          {index + 1}
          <RiArrowRightLine className="ml-2" />
        </span>
        <h3 className="text-2xl font-bold w-full max-w-2xl inline-flex items-center">
          <Balancer ratio={0.5}>{text}</Balancer>
        </h3>
      </div>
      <div className="w-auto min-w-96 flex flex-col place-self-start space-y-1 pl-20">
        {userOption ? (
          <Option
            {...userOption}
            index={options.findIndex((o) => o.id === userOption.id)}
            isCorrect={guessedCorrectly}
            isError={!guessedCorrectly}
          />
        ) : (
          <span className="text-sm italic bg-base-300 p-4 rounded-2xl place-self-start">
            You skipped this question
          </span>
        )}

        {!guessedCorrectly ? (
          <>
            <div className="text-sm !mt-6 !mb-1 block">Correct answer:</div>
            <Option
              {...correctOption}
              index={options.findIndex((o) => o.id === correctOption.id)}
              isCorrect={false}
              isError={false}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

export default function Details(props: Props) {
  const { cardSetId: cardSetId, submissionId } = props

  const router = useRouter()

  const {
    mutate: recreateDocument,
    isLoading: isRecreating_,
    data: recreated,
  } = trpc.cardSet.recreate.useMutation({
    onSuccess(cardSet) {
      setTimeout(() => router.push(`/card-set/${cardSet.id}/status`), 1500)
    },
  })
  const isRecreating = Boolean(isRecreating_ || recreated)

  const handleRecreateDocument = useCallback(() => {
    recreateDocument({ id: cardSetId })
  }, [cardSetId, recreateDocument])

  const {
    data: cardSet,
    isLoading,
    error,
  } = trpc.cardSet.findOne.useQuery({ id: cardSetId, submissionId })

  useEffect(() => {
    if (cardSet && !cardSet.submissionId) {
      router.replace('/card-set/' + cardSet.id)
    }
  }, [cardSet, router])

  return (
    <>
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
      {isLoading || error ? (
        <span className="loading loading-spinner loading-lg place-self-center justify-self-center my-auto" />
      ) : (
        <div className="flex flex-col pl-20 pt-16">
          <h3 className="text-5xl font-bold">
            <Balancer>
              Your score:{' '}
              {
                cardSet.questions.filter(
                  (q) => q.answer && q.answer.correctChoice === q.answer.userChoice,
                ).length
              }
              /{cardSet.questions.length}
            </Balancer>
          </h3>
          <div className="mt-8 mb-20 place-self-start space-x-2 flex items-center">
            <Link
              href={isRecreating ? '' : `/card-set/${cardSet.id}?retake=1`}
              className={clsx('btn btn-neutral', { 'btn-disabled': isRecreating })}
            >
              Take the test again
            </Link>
            <button
              onClick={handleRecreateDocument}
              disabled={isRecreating}
              className="btn btn-primary"
            >
              {isRecreating ? <span className="loading loading-spinner" /> : 'Regenerate questions'}
            </button>
          </div>
          {cardSet.questions.map((q, index) => (
            <Fragment key={q.id}>
              <div className="divider" />
              <Question index={index} {...q} />
            </Fragment>
          ))}
          <div className="divider" />
          <div className="my-8 place-self-start space-x-2 flex items-center">
            <Link
              href={`mailto:support@stigma.dev?subject=Feedback on ${cardSetId}/${submissionId}`}
              className="btn btn-neutral"
            >
              Send feedback
              <RiMailLine className="w-6 h-6" />
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
