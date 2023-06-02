'use client'

import '../firebase'

import { trpc } from '@/requests/trpc'
import { useEffect } from 'react'
import {
  getAuth,
  isSignInWithEmailLink,
  signInWithEmailLink,
  connectAuthEmulator,
  inMemoryPersistence,
} from 'firebase/auth'

type Props = {
  email: string
  continueTo?: string
}

if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST) {
  const auth = getAuth()
  connectAuthEmulator(auth, 'http://' + process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST)
}

export default function CreateSession(props: Props) {
  const { email, continueTo } = props
  const { mutateAsync: createSession } = trpc.auth.createSession.useMutation()

  useEffect(() => {
    const url = new URL(window.location.href)
    if (isSignInWithEmailLink(getAuth(), window.location.href)) {
      getAuth()
        .setPersistence(inMemoryPersistence)
        .then(() => signInWithEmailLink(getAuth(), email, window.location.href))
        .then(({ user }) => user.getIdToken())
        .then((idToken) => createSession({ idToken }))
        .then(() => {
          if (continueTo) {
            const next = new URL(continueTo)
            next.searchParams.append('login', '1')
            window.location.href = next.href
          } else {
            window.location.href = '/?login=1'
          }
        })
        .catch((err) => {
          url.searchParams.append('error', (err as any).message || 'Unknown error')
          window.location.href = url.href
        })
    } else {
      url.searchParams.append('error', 'Invalid link provided')
      window.location.href = url.href
    }
  }, [email, continueTo, createSession])

  return null
}
