'use client'

import { trpc } from '@/requests/trpc'
import { useClipboard } from '@/hooks/use-clipboard'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { RiArrowRightLine, RiCheckFill, RiErrorWarningLine, RiShareLine } from 'react-icons/ri'
import Link from 'next/link'
import type { UserSession } from '@/app/get-server-session'

type Props = {
  user: UserSession | null
  cardSetId: string
}

function Step(props: { name: string; state: 'ACTIVE' | 'COMPLETE' | 'NONE' }) {
  const { name, state } = props
  const [shown, setShown] = useState(false)

  useEffect(() => setShown(true), [])

  if (state === 'NONE') {
    return null
  }

  return (
    <li data-content={state === 'COMPLETE' ? '✓' : '●'} className="step step-primary">
      <span
        className={clsx(
          'transition-all duration-200 ease-in-out opacity-0 scale-75 text-start',
          shown && 'opacity-100 !scale-100',
        )}
      >
        {name}
        {state === 'ACTIVE' ? (
          <span className="inline-block -mb-1 ml-2 loading loading-xs loading-spinner"></span>
        ) : null}
      </span>
    </li>
  )
}

export default function Steps(props: Props) {
  const { cardSetId, user } = props

  const url = new URL(
    typeof window === 'undefined' ? 'http://localhost:3000' : window.location.href,
  )
  url.pathname = '/card-set/' + cardSetId
  url.search = ''
  const clipboard = useClipboard(url.href, 3000)

  const {
    data: cardSet,
    isLoading,
    error,
  } = trpc.cardSet.findOne.useQuery(
    { id: cardSetId },
    { refetchInterval: (data) => (data && ['READY', 'ERROR'].includes(data.status) ? 0 : 1000) },
  )

  const { mutateAsync: prepare, status: prepareStatus } = trpc.cardSet.prepare.useMutation()

  useEffect(() => {
    if (!cardSet) {
      return
    }

    if (cardSet.status === 'WAITING' && prepareStatus === 'idle') {
      prepare({ id: cardSet.id })
    }
  }, [cardSet, prepare, prepareStatus])

  if (isLoading || error) {
    return <span className="loading loading-lg loading-spinner"></span>
  }

  const step =
    cardSet.status === 'STARTING'
      ? 1
      : cardSet.status === 'ANALYZING'
      ? 2
      : cardSet.status === 'WAITING'
      ? 3
      : cardSet.status === 'PREPARING'
      ? 4
      : cardSet.status === 'READY'
      ? 5
      : 0

  return (
    <>
      <ul className="steps steps-vertical">
        <Step name="Uploading" state={step > 1 ? 'COMPLETE' : step === 1 ? 'ACTIVE' : 'NONE'} />
        <Step
          name={step === 2 ? 'Reading file (might take a minute)' : 'Reading file'}
          state={step > 2 ? 'COMPLETE' : step === 2 ? 'ACTIVE' : 'NONE'}
        />
        <Step
          name="Starting analysis"
          state={step > 3 ? 'COMPLETE' : step === 3 ? 'ACTIVE' : 'NONE'}
        />
        <Step
          name="Preparing questions"
          state={step > 4 ? 'COMPLETE' : step === 4 ? 'ACTIVE' : 'NONE'}
        />
        <Step name="READY!" state={step >= 5 ? 'COMPLETE' : 'NONE'} />
      </ul>
      {cardSet.status === 'READY' ? (
        <div className="flex flex-row space-x-2 py-4">
          <button className="btn btn-neutral" onClick={clipboard.onCopy}>
            {clipboard.hasCopied ? (
              <RiCheckFill />
            ) : (
              <>
                <span className="hidden sm:block">Copy share link</span>
                <RiShareLine className="sm:hidden" />
              </>
            )}
          </button>
          <Link className="btn btn-primary" href={`/card-set/${cardSet.id}`} replace>
            Go to test <RiArrowRightLine className="w-4 h-4" />
          </Link>
        </div>
      ) : cardSet.status === 'ERROR' ? (
        <div className="flex flex-col pr-4">
          <div className="flex items-start alert alert-error mt-4 mr-4">
            <RiErrorWarningLine className="w-10 h-6" />
            <span>Error: {cardSet.error}</span>
          </div>
          <span className="text-gray-500 text-sm py-4">
            * All tokens were refunded. Contact{' '}
            <a
              className="link"
              href={`mailto:support@stigma.dev?subject=Encountered error with ${cardSetId}`}
            >
              support@stigma.dev
            </a>{' '}
            if the issue persists.
          </span>
        </div>
      ) : null}
    </>
  )
}
