'use client'

import { CSSProperties } from 'react'
import { MdOutlineClose, MdOutlinePending } from 'react-icons/md'
import { trpc } from '@/requests/trpc'
import clsx from 'clsx'
import Link from 'next/link'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/server/routers/app'

dayjs.extend(relativeTime)

type AllCardsType = inferRouterOutputs<AppRouter>['cardSet']['findAll']

export default function AllCards({
  className,
  allCards: defaultCards,
}: {
  className?: string
  allCards: AllCardsType
}) {
  const { data: allCards = defaultCards } = trpc.cardSet.findAll.useQuery(undefined, {
    initialData: defaultCards,
  })

  return (
    <div className={clsx('grid grid-cols-3 gap-8', className)}>
      {allCards.map((card) => {
        const correctAnswers = card.questions.filter(
          (q) => q.answer && q.answer.correctChoice === q.answer.userChoice,
        )
        const value = Math.max((correctAnswers.length / card.questions.length) * 100, 10)
        const isReady = card.status === 'READY'
        const isError = card.status === 'ERROR'

        return (
          <Link
            key={card.id}
            className="flex flex-col justify-center min-h-24 w-full p-4 select-none bg-base-200 rounded-2xl border-2 border-gray-500 border-dashed hover:border-purple-500 hover:cursor-pointer"
            href={
              isReady
                ? card.submissionId
                  ? `/card-set/${card.id}/submission/${card.submissionId}`
                  : `/card-set/${card.id}`
                : `/card-set/${card.id}/status`
            }
          >
            <div className="flex flex-row items-center">
              {isReady ? (
                <div
                  className="radial-progress text-neutral-500"
                  style={
                    {
                      '--value': 100,
                      '--size': '1.2rem',
                      minWidth: '1.2rem',
                    } as CSSProperties
                  }
                >
                  {card.submissionId ? (
                    <div
                      className={clsx('absolute top-0 left-0 right-0 bottom-0 radial-progress', {
                        'text-success': value > 90,
                        'text-warning': value > 50,
                        'text-error': value <= 50,
                      })}
                      style={{ '--value': value, '--size': '1.2rem' } as CSSProperties}
                    />
                  ) : null}
                </div>
              ) : isError ? (
                <MdOutlineClose className="text-error text-xl" style={{ minWidth: '1.2rem' }} />
              ) : (
                <MdOutlinePending className="text-xl" style={{ minWidth: '1.2rem' }} />
              )}
              <span className="text-xl line-clamp-1 ml-2">{card.title}</span>
            </div>
            <span
              className={clsx('mt-2', {
                italic: !isReady && !isError,
                'text-error line-clamp-1': isError,
              })}
            >
              {isReady
                ? card.questions.length + ' Questions'
                : isError
                ? 'Error: ' + card.error
                : 'Analysing...'}
            </span>
            <span className="text-neutral-500 text-xs">{dayjs(card.createdAt).fromNow()}</span>
          </Link>
        )
      })}
    </div>
  )
}
