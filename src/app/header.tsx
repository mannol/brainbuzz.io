'use client'

import Modal from '@/components/modal'
import useBoolean from '@/hooks/use-boolean'
import useMemoizedCallback from '@/hooks/use-memoized-callback'
import { trpc } from '@/requests/trpc'
import { formatMoney } from 'accounting'
import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import { ary } from 'lodash'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { RiCoinsFill, RiErrorWarningLine, RiRefund2Line } from 'react-icons/ri'

type Props = {
  tokens: number
  loggedInUserEmail?: string
}

dayjs.extend(advancedFormat)

export default function Header({ tokens: defaultTokens, loggedInUserEmail }: Props) {
  const [showTokens, setShowTokens] = useBoolean(false)

  const {
    data: logoutData,
    mutateAsync: logout,
    isLoading: isLoggingOut,
  } = trpc.auth.logout.useMutation({
    onSuccess() {
      window.location.href = '/'
    },
  })
  const isLoggingOutOrRedirecting = isLoggingOut || Boolean(logoutData)

  const {
    data: payments,
    isLoading: isLoadingPayments,
    isFetching: isFetchingPayments,
    error: errorPayments,
    refetch: refetchPayments,
  } = trpc.billing.findAllPayments.useQuery(undefined, { enabled: showTokens })

  const { data: tokens, refetch: refetchTokens } = trpc.billing.availableTokenCount.useQuery(
    undefined,
    {
      initialData: defaultTokens,
    },
  )
  const { refetch: refetchCards } = trpc.cardSet.findAll.useQuery()

  const [refundingPayment, setRefundingPayment] = useState<
    NonNullable<typeof payments>[number] | null
  >(null)

  const {
    mutate: refund,
    reset: resetRefund,
    error: errorRefunding,
    isLoading: isRefunding,
  } = trpc.billing.refundPayment.useMutation({
    async onSuccess() {
      await Promise.all([refetchPayments(), refetchTokens(), refetchCards()])
      resetRefund()
      setRefundingPayment(null)
    },
  })

  const handleShowConfirmPaymentRefundModal = useMemoizedCallback(
    (payemnt: NonNullable<typeof payments>[number]) => () => setRefundingPayment(payemnt),
    [],
  )
  const handleHideConfirmPaymentRefundModal = useCallback(() => {
    setRefundingPayment(null)
    resetRefund()
  }, [resetRefund])

  const handleRefund = useCallback(() => {
    if (refundingPayment) {
      refund({ paymentId: refundingPayment.id })
    }
  }, [refund, refundingPayment])

  return (
    <>
      <Modal isOpen={showTokens} onClose={setShowTokens.off} showCloseButton hideOnOutsideClick>
        <div className="flex flex-col">
          {isLoadingPayments || errorPayments ? (
            <div className="flex items-center justify-center min-h-64 w-full">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 font-medium mb-3">
                NOTE: Refunds can be automatically requested within 24 hours of purchase.
              </p>
              <ul className="flex flex-col min-h-64 space-y-2">
                {payments?.map((payment) => (
                  <li key={payment.id} className="flex flex-col bg-base-300 rounded-lg">
                    <div className="flex flex-row items-center justify-between min-h-16 p-4">
                      <div className="flex flex-col">
                        <span className="text-xl font-bold">
                          {formatMoney((payment.amount / 100) * (payment.tokens / 5), 'USD $')}
                        </span>
                        <span className="text-gray-500 text-sm">For {payment.tokens} tokens</span>
                      </div>
                      {payment.canRefund ? (
                        <button
                          className="btn btn-neutral btn-sm"
                          onClick={handleShowConfirmPaymentRefundModal(payment)}
                        >
                          Refund <RiRefund2Line className="w-4 h-4" />
                        </button>
                      ) : payment.refundedAt ? (
                        <div className="badge badge-error badge-sm">
                          <RiRefund2Line className="w-3 h-3 mr-1" />
                          refunded
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center h-6 text-xs text-gray-400 w-full bg-gray-800 rounded-b-lg px-4">
                      Purchased:{' '}
                      <code className="font-bold ml-2">
                        {dayjs(payment.createdAt).format('Do MMM YYYY [at] HH:mm')}
                      </code>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(refundingPayment)}
        onClose={handleHideConfirmPaymentRefundModal}
        hideOnOutsideClick
      >
        <div className="flex flex-col">
          <div className="text-sm">
            Are you sure you want to proceed with issuing a refund of {refundingPayment?.tokens}{' '}
            tokens (
            {refundingPayment
              ? formatMoney(
                  (refundingPayment.amount / 100) * (refundingPayment.tokens / 5),
                  'USD $',
                )
              : '$ 0'}
            )?{' '}
            <span className="text-error">
              Please note that all your created quizzes will be lost.
            </span>
          </div>
          {errorRefunding ? (
            <div className="flex items-start alert alert-error my-2 text-sm p-2 rounded-lg">
              <RiErrorWarningLine className="w-6 h-5 -mr-2" />
              <span>Error: {errorRefunding.message}</span>
            </div>
          ) : null}
          <div className="flex items-center self-end space-x-2 mt-3">
            <button
              disabled={isRefunding || isFetchingPayments}
              className="btn btn-neutral btn-sm"
              onClick={handleHideConfirmPaymentRefundModal}
            >
              Cancel
            </button>
            <button
              disabled={isRefunding || isFetchingPayments}
              className="btn btn-neutral btn-sm"
              onClick={handleRefund}
            >
              {isRefunding || isFetchingPayments ? (
                <span className="loading loading-spinner" />
              ) : errorRefunding ? (
                'Retry'
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </Modal>
      <div className="navbar bg-base-100 flex justify-center px-6">
        <div className="flex flex-1 max-w-2xl flex-col items-start sm:flex-row  sm:items-center">
          <div className="flex-1 -ml-4">
            <Link className="btn btn-ghost normal-case text-xl" href="/">
              BrainBuzz
            </Link>
          </div>
          <div className="flex flex-none items-center -ml-4 flex-row-reverse sm:flex-row sm:-mr-4 sm:ml-0">
            {loggedInUserEmail ? (
              <>
                <button
                  onClick={setShowTokens.on}
                  className="btn btn-xs btn-outline btn-warning group mr-3 hidden"
                >
                  <RiCoinsFill className="text-lg text-gray-200 group-hover:text-gray-800" />
                  <span className="hidden sm:inline">{tokens} tokens</span>
                </button>
                <ul className="menu menu-horizontal px-1">
                  <li>
                    <details>
                      <summary>{loggedInUserEmail}</summary>
                      <ul className="!mt-2 w-full p-2 !bg-neutral-focus">
                        <li>
                          <button
                            onClick={ary(logout, 0)}
                            className={
                              isLoggingOutOrRedirecting ? 'flex justify-center' : undefined
                            }
                            disabled={isLoggingOutOrRedirecting}
                          >
                            {isLoggingOutOrRedirecting ? (
                              <span className="loading loading-spinner" />
                            ) : (
                              'Logout'
                            )}
                          </button>
                        </li>
                      </ul>
                    </details>
                  </li>
                </ul>
              </>
            ) : (
              <Link className="btn btn-ghost normal-case underline" href="/login">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
