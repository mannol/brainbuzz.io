import '@/app/firebase-admin'

import { cookies } from 'next/headers'
import { getAuth } from 'firebase-admin/auth'
import { pick } from 'lodash'
import { redirect } from 'next/navigation'

async function getServerSession() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('session')

  if (!sessionCookie) {
    return null
  }

  const decodedIdToken = await getAuth()
    .verifySessionCookie(sessionCookie.value, true)
    .catch((err) => {
      if (err.errorInfo.code === 'auth/user-not-found') {
        redirect('/api/logout')
      } else {
        console.error(err)
      }
      return null
    })

  if (!decodedIdToken) {
    return null
  }

  const user = await getAuth().getUser(decodedIdToken.uid)
  return pick(user, ['uid', 'email'])
}

export type UserSession = NonNullable<Awaited<ReturnType<typeof getServerSession>>>

export default getServerSession
