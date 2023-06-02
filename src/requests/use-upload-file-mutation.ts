import { round } from 'lodash'
import { useCallback, useRef, useState } from 'react'
import { trpc } from './trpc'

export type UploadFileMutationVariables = {
  file: Blob | File | any
  fileName: string
  contentType: string
}

function useUploadFileMutation(): {
  mutateAsync: (options: UploadFileMutationVariables) => Promise<string | null>
  data: string | null
  error: {
    message: string
  } | null
  isLoading: boolean
  called: boolean
  reset(): void
  abort(): void
  progress: number
} {
  const [error, setError] = useState<{ message: string } | null>(null)
  const [isLoading, setLoading] = useState<boolean>(false)
  const [called, setCalled] = useState<boolean>(false)
  const [data, setData] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const abortEvent = useRef<(() => void) | null>(null)

  const createSignedUrlMutation = trpc.upload.createSignedUrl.useMutation()

  const reset = useCallback(() => {
    setError(null)
    setLoading(false)
    setCalled(false)
    setProgress(0)
  }, [])

  const abort = useCallback(() => {
    if (abortEvent.current) {
      abortEvent.current()
    }
  }, [])

  const mutateAsync = useCallback(
    async (options: UploadFileMutationVariables) => {
      const { file, contentType } = options

      let interrupted = false
      try {
        setLoading(true)
        setCalled(true)

        abortEvent.current = () => {
          reset()
          interrupted = true
        }

        const { key, signedUrl } = await createSignedUrlMutation.mutateAsync({ contentType })

        if (interrupted) {
          return null
        }

        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener(
          'progress',
          (e) => setProgress(round((e.loaded / e.total) * 100)),
          false,
        )
        xhr.open('PUT', signedUrl, true)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.send(file)

        abortEvent.current = () => {
          reset()
          xhr.abort()
          interrupted = true
        }

        await new Promise((resolve, reject) => {
          xhr.onreadystatechange = function (e) {
            if (xhr.readyState !== 4) {
              return
            }
            if (xhr.status >= 200 && xhr.status < 300) {
              setProgress(100)
              resolve(null)
            } else {
              setProgress(0)
              reject({ message: xhr.responseText || 'Network error' })
            }
          }
        })

        abortEvent.current = null

        setData(key)
        setLoading(false)
        return key
      } catch (err) {
        if (interrupted) {
          return null
        }
        setError({ message: (err as Error).message || 'Unknown error' })
        setLoading(false)
        throw err
      }
    },
    [createSignedUrlMutation, reset],
  )

  return {
    mutateAsync,
    reset,
    abort,
    data,
    called,
    error,
    progress,
    isLoading,
  }
}

export default useUploadFileMutation
