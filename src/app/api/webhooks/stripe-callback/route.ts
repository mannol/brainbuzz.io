import '@/app/firebase-admin'

import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAuth } from 'firebase-admin/auth'
import prisma from '@/lib/prisma'
import { times } from 'lodash'
import { Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('Please provide STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env variables')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })
const secret = process.env.STRIPE_WEBHOOK_SECRET

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const email = session.customer_details?.email
  const rid = session.client_reference_id
  const paymentIntentId = session.payment_intent

  if (!rid) {
    console.warn('Payment is missing reconciliation id:', paymentIntentId)
    return NextResponse.json({ success: true })
  }

  const { data: items } = await stripe.checkout.sessions.listLineItems(session.id)
  const item = items[0]

  if (!item || !item.quantity) {
    console.warn('Payment is missing line item information:', paymentIntentId)
    return NextResponse.json({ success: true })
  }

  const user = email
    ? await getAuth()
        .getUserByEmail(email)
        .catch((err) => {
          if ((err as any)?.errorInfo?.code === 'auth/user-not-found') {
            return getAuth().createUser({ email })
          }
          throw err
        })
    : null

  if (!user) {
    console.error("Couldn't create or find the user with email: " + email)
    return NextResponse.json(
      {
        title: 'Internal Server Error',
        message: "Couldn't create or find the user with email: " + email,
      },
      { status: 500 },
    )
  }

  const metadata = z
    .object({
      isCostlessRefundApplied: z.coerce.number().min(0).max(1),
    })
    .safeParse(session.metadata)

  if (!metadata.success) {
    console.error('Incorrect metadata: ' + metadata.error.message)
    return NextResponse.json(
      { title: 'Internal Server Error', message: 'Incorrect metadata: ' + metadata.error.message },
      { status: 500 },
    )
  }

  const handled = await prisma.payment.findFirst({ where: { id: paymentIntentId as string } })
  if (handled) {
    console.warn('Already handled payment:', paymentIntentId)
    return NextResponse.json({ success: true })
  }

  await prisma.payment.create({
    data: {
      id: paymentIntentId as string,
      amount: item.amount_total,
      reconciliationId: rid,
      isCostlessRefundApplied: metadata.data.isCostlessRefundApplied === 1,
      user: {
        connectOrCreate: {
          create: {
            id: user.uid,
          },
          where: {
            id: user.uid,
          },
        },
      },
      tokens: {
        createMany: {
          data: times(item.quantity, (): Prisma.TokenCreateManyPaymentInput => ({ id: nanoid() })),
        },
      },
    },
  })

  return NextResponse.json({ success: true })
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const payment = await prisma.payment.findUnique({
    where: { id: charge.payment_intent as string },
  })

  if (payment && !payment.refundedAt) {
    const refund = charge.refunds?.data[0]

    const refundedAt = refund ? dayjs(refund.created).toDate() : new Date()
    const refundedAmount = refund ? refund.amount : 0

    await prisma.$transaction([
      prisma.payment.update({
        data: { refundedAt, refundedAmount },
        where: { id: charge.payment_intent as string },
      }),
      prisma.cardSet.updateMany({
        data: { refundedAt },
        where: {
          redeemedTokens: { some: { payment: { id: charge.payment_intent as string } } },
        },
      }),
      prisma.token.updateMany({
        data: { redeemedAt: null, redeemedByCardSetId: null },
        where: {
          redeemedByCardSet: {
            redeemedTokens: { some: { payment: { id: charge.payment_intent as string } } },
          },
        },
      }),
    ])

    console.log(`Refunded all tokens with payment intent ID ${charge.payment_intent}`)
  }

  return NextResponse.json({ success: true })
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('Request is not signed')
    return NextResponse.json(
      { title: 'Bad Request', message: 'Request is not signed' },
      { status: 400 },
    )
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret)
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { title: 'Bad Request', message: 'Request is invalid' },
      { status: 400 },
    )
  }

  try {
    if (event.type === 'checkout.session.completed') {
      return handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
    } else if (event.type === 'charge.refunded') {
      return handleChargeRefunded(event.data.object as Stripe.Charge)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { title: 'Internal Server Error', message: "Couldn't handle this request" },
      { status: 500 },
    )
  }
}
