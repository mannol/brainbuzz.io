import { initializeApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: 'AIzaSyCIIwHzQnVwUMg-XfUbUTyT876vyqTu_ng',
  authDomain: 'brainbuzz-ai.firebaseapp.com',
  projectId: 'brainbuzz-ai',
  storageBucket: 'brainbuzz-ai.appspot.com',
  messagingSenderId: '760950859820',
  appId: '1:760950859820:web:bc4500485bdbc4f8b5c989',
  measurementId: 'G-MPL4NCCQ70',
}

const app = initializeApp(firebaseConfig)

export { app as firebaseApp }
