import { z } from 'zod'
import Stripe from 'stripe'
import { nanoid } from 'nanoid'
import prisma from '@/lib/prisma'
import { isObject, pick } from 'lodash'
import { TRPCError } from '@trpc/server'
import dayjs from 'dayjs'
import { procedure, router } from '../trpc'
import { getAuth } from 'firebase-admin/auth'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Please provide STRIPE_SECRET_KEY env variable')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })

export const billingRouter = router({
  createCheckoutSession: procedure
    .input(
      z.object({
        price: z.string(),
        quantity: z.number().min(5),
        nextUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async (opts) => {
      const reconciliationId = nanoid()

      const user = opts.ctx.user
      const successUrl = new URL(opts.input.nextUrl)
      successUrl.searchParams.append('success', '1')
      successUrl.searchParams.append('rid', reconciliationId)

      const options: Stripe.Checkout.SessionCreateParams = {
        client_reference_id: reconciliationId,
        customer_creation: 'if_required',
        cancel_url: opts.input.cancelUrl,
        success_url: successUrl.href,
        customer_email: user?.email,
        mode: 'payment',
        line_items: [
          {
            price: opts.input.price,
            quantity: opts.input.quantity,
            adjustable_quantity: {
              enabled: true,
              minimum: opts.input.quantity,
            },
          },
        ],
        metadata: {
          isCostlessRefundApplied: 0, // TODO: check if the costless refund can be applied
        },
        allow_promotion_codes: true,
        automatic_tax: {
          enabled: true,
        },
      }

      const session = await stripe.checkout.sessions.create(options)

      return {
        url: session.url!,
      }
    }),
  checkoutSessionStatus: procedure
    .input(
      z.object({
        rid: z.string(),
      }),
    )
    .query(async (opts) => {
      const paid = await prisma.payment.findFirst({
        where: {
          reconciliationId: opts.input.rid,
        },
      })

      let status: 'PAID' | 'UNPAID'

      if (paid) {
        status = 'PAID'
      } else {
        status = 'UNPAID'
      }

      return {
        status,
        requireLogin:
          opts.ctx.user || !paid
            ? null
            : await getAuth()
                .getUser(paid.userId)
                .then((user) => ({ email: user.email! })),
      }
    }),
  refundPayment: procedure
    .input(
      z.object({
        paymentId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const user = opts.ctx.user
      const paymentId = opts.input.paymentId

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      })

      if (!payment || payment.userId !== user?.uid) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have the permissions to refund this transaction",
        })
      }

      if (payment.refundedAt) {
        return { success: true }
      }

      if (dayjs().diff(dayjs(payment.createdAt), 'hour') >= 24) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'The refunds can be processed within the first 24 hours',
        })
      }

      const stripePayment = await stripe.paymentIntents.retrieve(paymentId, {
        expand: ['latest_charge.balance_transaction'],
      })

      if (
        !stripePayment ||
        !isObject(stripePayment.latest_charge) ||
        !isObject(stripePayment.latest_charge?.balance_transaction)
      ) {
        console.log(
          'Refund attempt latest_charge:',
          JSON.stringify(stripePayment.latest_charge, null, 2),
        )

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error communicating to stripe',
        })
      }

      const charge = stripePayment.latest_charge as Stripe.Charge
      const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction

      const refund = await stripe.refunds.create({
        payment_intent: paymentId,
        reason: 'requested_by_customer',
        amount: payment.isCostlessRefundApplied
          ? balanceTransaction.amount
          : balanceTransaction.net,
      })

      const refundedAt = dayjs(refund.created).toDate()

      await prisma.$transaction([
        prisma.payment.update({
          data: { refundedAt },
          where: { id: paymentId },
        }),
        prisma.cardSet.updateMany({
          data: { refundedAt },
          where: {
            redeemedTokens: { some: { payment: { id: paymentId } } },
          },
        }),
        prisma.token.updateMany({
          data: { redeemedAt: null, redeemedByCardSetId: null },
          where: {
            redeemedByCardSet: {
              redeemedTokens: { some: { payment: { id: paymentId } } },
            },
          },
        }),
      ])

      console.log(`Refunded all tokens with payment intent ID ${paymentId}`)

      return {
        success: true,
      }
    }),
  findAllPayments: procedure.query(async (opts) => {
    const user = opts.ctx.user

    if (!user) {
      return []
    }

    const payments = await prisma.payment.findMany({
      where: { user: { id: user.uid } },
      include: { tokens: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return payments.map((payment) => ({
      ...pick(payment, ['id', 'amount', 'createdAt', 'refundedAt']),
      tokens: payment.tokens.length,
      canRefund: !payment.refundedAt && dayjs().diff(dayjs(payment.createdAt), 'hour') < 24,
    }))
  }),
  availableTokenCount: procedure.query(async (opts) => {
    const user = opts.ctx.user

    if (!user) {
      return 0
    }

    return prisma.token.count({
      where: {
        redeemedAt: null,
        payment: { user: { id: user.uid }, refundedAt: null },
      },
    })
  }),
})
