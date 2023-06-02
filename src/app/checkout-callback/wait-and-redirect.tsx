'use client'

import '../firebase'

import { trpc } from '@/requests/trpc'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type Props = {
  rid: string
  continueTo?: string
}

export default function WaitAndRedirect(props: Props) {
  const { rid, continueTo } = props

  const router = useRouter()
  const { data } = trpc.billing.checkoutSessionStatus.useQuery({ rid }, { refetchInterval: 1000 })

  useEffect(() => {
    if (data?.status === 'PAID') {
      if (data.requireLogin) {
        const params = new URLSearchParams()
        params.append('email', data.requireLogin.email)
        params.append('continueTo', continueTo || '')
        router.replace('/login?' + params.toString())
      } else {
        router.replace(continueTo || '/')
      }
    }
  }, [continueTo, data, router])

  return null
}
