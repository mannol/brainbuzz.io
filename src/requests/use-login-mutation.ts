import '@/app/firebase'
import { useMutation } from '@tanstack/react-query'
import { connectAuthEmulator, getAuth, sendSignInLinkToEmail } from 'firebase/auth'
import { useRouter } from 'next/navigation'

if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST) {
  const auth = getAuth()
  connectAuthEmulator(auth, 'http://' + process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST)
}

function useLoginMutation() {
  const router = useRouter()

  return useMutation(
    ['login'],
    async (opts: { email: string }) => {
      const auth = getAuth()

      const url = new URL(window.location.href)
      url.pathname = '/login-callback'
      url.searchParams.append('email', opts.email)

      await sendSignInLinkToEmail(auth, opts.email, {
        url: url.href,
        handleCodeInApp: true,
      })

      return opts
    },
    {
      onSuccess(opts) {
        const url = new URL(window.location.href)
        url.search = ''
        url.searchParams.append('checkEmail', '1')
        url.searchParams.append('email', opts.email)
        router.replace(url.href)
      },
      onError(error: any) {
        const url = new URL(window.location.href)
        url.searchParams.append(
          'error',
          error?.errorInfo?.message || error?.message || error || 'Unknown error happened',
        )
        router.replace(url.href)
      },
    },
  )
}

export default useLoginMutation
