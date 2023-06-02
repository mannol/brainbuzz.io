import 'server-only'

import { getApp, getApps, initializeApp, cert } from 'firebase-admin/app'

if (!process.env.FIREBASE_CONFIG || process.env.FIREBASE_CONFIG[0] !== '{') {
  throw new Error('FIREBASE_CONFIG is missing')
}

const app = getApps().length
  ? getApp()
  : initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_CONFIG)),
      projectId: 'brainbuzz-ai',
    })

export { app as firebaseAdminApp }
