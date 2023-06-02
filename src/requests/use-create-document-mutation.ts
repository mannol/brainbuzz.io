import { useMutation } from '@tanstack/react-query'
import useUploadFileMutation, { UploadFileMutationVariables } from './use-upload-file-mutation'
import { useCallback } from 'react'
import { trpc } from './trpc'

type Props = {
  onSuccess?: (cardSetId: string, variables: UploadFileMutationVariables) => void
}

function useCreateDocumentMutation(options?: Props) {
  const { onSuccess } = options || {}

  const uploadFileMutation = useUploadFileMutation()
  const createCardSetMutation = trpc.cardSet.create.useMutation()

  const baseMutation = useMutation<any, Error, UploadFileMutationVariables>(
    ['create-document'],
    async (options: UploadFileMutationVariables) => {
      const fileKey = await uploadFileMutation.mutateAsync(options)
      if (!fileKey) {
        // interrupted
        return
      }

      const res = await createCardSetMutation.mutateAsync({ fileKey, title: options.fileName })
      return res.id
    },
    {
      onSuccess,
    },
  )

  const reset = useCallback(() => {
    uploadFileMutation.reset()
    baseMutation.reset()
  }, [baseMutation, uploadFileMutation])

  return {
    ...baseMutation,
    progress: uploadFileMutation.progress,
    abort: uploadFileMutation.abort,
    reset,
  }
}

export default useCreateDocumentMutation
