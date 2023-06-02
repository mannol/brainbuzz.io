'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DropzoneOptions, ErrorCode, FileRejection } from 'react-dropzone'
import { BsFiletypePdf, BsFiletypeDoc, BsFiletypeDocx } from 'react-icons/bs'
import UploadDropzone from '@/components/upload-dropzone'
import useCreateDocumentMutation from '@/requests/use-create-document-mutation'
import { useRouter } from 'next/navigation'

export default function UploadZone({ className }: { className?: string }) {
  const router = useRouter()

  const {
    mutateAsync: createDocument,
    reset,
    abort,
    error: mutationError,
    isLoading,
    progress,
    data,
  } = useCreateDocumentMutation({
    onSuccess(cardSetId) {
      if (cardSetId) {
        setTimeout(() => router.push(`/card-set/${cardSetId}/status`), 1500)
      }
    },
  })

  useEffect(() => {
    return () => reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [stateError, setStateError] = useState<Error | null>(null)

  const handleDrop = useCallback(
    async (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length) {
        const first = rejections[0]
        const message = {
          [ErrorCode.FileInvalidType]: 'Please select .pdf, .doc or .docx file',
          [ErrorCode.FileTooLarge]: 'File is too large (Max. 50MB)',
          [ErrorCode.FileTooSmall]: 'File is too small',
          [ErrorCode.TooManyFiles]: 'Please select only one file',
        }[first.errors[0].code]

        setStateError(new Error(message))
        return
      }

      const file = accepted[0]

      await createDocument({
        file,
        fileName: file.name,
        contentType: file.type,
      })
    },
    [createDocument],
  )

  const handleReset = useCallback(() => {
    setStateError(null)
    reset()
  }, [reset])

  const DropzoneProps = useMemo(
    (): DropzoneOptions => ({
      onDrop: handleDrop,
      accept: {
        'application/pdf': [],
        'application/msword': [],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
      },
      multiple: false,
      maxSize: 1024 * 1024 * 50,
    }),
    [handleDrop],
  )

  const error = mutationError || stateError

  return (
    <UploadDropzone
      className={className}
      icons={
        <div className="flex flex-row items-center space-x-2">
          <BsFiletypePdf className="w-10 h-10" />
          <div className="divider divider-horizontal" />
          <BsFiletypeDoc className="w-10 h-10" />
          <div className="divider divider-horizontal" />
          <BsFiletypeDocx className="w-10 h-10" />
        </div>
      }
      hint="Click here or drop a file to get started"
      isLoading={isLoading}
      progress={progress}
      DropzoneProps={DropzoneProps}
      onCancel={abort}
      onReset={handleReset}
      errorText={error ? error.message || 'Something went wrong' : null}
      successText={data ? 'Upload successful! Please wait...' : null}
    />
  )
}
