import clsx from 'clsx'
import { useDropzone, DropzoneOptions } from 'react-dropzone'
import {
  RiDragDropLine,
  RiErrorWarningLine,
  RiRefreshLine,
  RiUploadCloud2Line,
  RiUploadCloudLine,
} from 'react-icons/ri'
import { ReactElement, useEffect, useMemo, useState } from 'react'
import Lottie, { EventListener as LottieEventListener } from 'react-lottie'
import useBoolean from '@/hooks/use-boolean'
import checkmarkAnimation from './checkmark-animation.json'

const animationOptions = {
  loop: false,
  autoplay: true,
  animationData: checkmarkAnimation,
  rendererSettings: {
    preserveAspectRatio: 'xMidYMid slice',
  },
}

type UploadDropzoneProps = {
  icons: ReactElement
  hint: string
  disabled?: boolean
  isLoading: boolean
  progress: number
  onCancel: () => void
  onReset: () => void
  errorText?: string | null
  successText?: string | null
  DropzoneProps?: DropzoneOptions | null
  className?: string
  children?: React.ReactNode
}

function UploadDropzone(props: UploadDropzoneProps) {
  const {
    icons,
    hint,
    disabled,
    isLoading,
    progress,
    errorText,
    successText,
    onCancel,
    onReset,
    DropzoneProps,
    children,
    className,
    ...rest
  } = props

  const hasState = isLoading || Boolean(errorText) || Boolean(successText)

  const [uploadIconVariant, setUploadIconVariant] = useBoolean(true)
  const [isAnimating, setAnimating] = useState(true)

  const eventListeners: LottieEventListener[] = useMemo(
    () => [{ eventName: 'complete', callback: () => setAnimating(false) }],
    [],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    ...DropzoneProps,
    disabled: disabled || hasState,
  })

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(setUploadIconVariant.toggle, 1000)
      return () => clearInterval(interval)
    } else {
      setUploadIconVariant.on()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  return (
    <div
      className={clsx(
        className,
        'w-full px-8 py-3 flex flex-col items-center justify-center select-none relative bg-base-200 rounded-2xl border-2 border-purple-500 border-dashed',
        !hasState && !disabled
          ? 'hover:cursor-pointer active:cursor-pointer hover:opacity-80 active:opacity-90'
          : null,
      )}
      {...rest}
      {...getRootProps()}
    >
      {errorText ? (
        <>
          <RiErrorWarningLine className="w-10 h-10 text-error mb-2" />
          <p className="text-center max-w-full text-sm text-error">{errorText}</p>
          <button className="btn btn-primary btn-sm mt-8" onClick={onReset}>
            Click here to retry
            <RiRefreshLine className="ml-4 text-sm" />
          </button>
        </>
      ) : successText ? (
        <>
          <Lottie
            style={{ cursor: 'inherit' }}
            isClickToPauseDisabled={true}
            options={animationOptions}
            eventListeners={eventListeners}
            height={56}
            width={56}
          />
          <p
            className={clsx(
              'mt-4 text-lg text-center font-semibold transition-all duration-200 ease-in-out opacity-0 scale-75',
              !isAnimating && 'opacity-100 !scale-100',
            )}
          >
            {successText}
          </p>
        </>
      ) : (
        <>
          <input {...getInputProps()} disabled={isLoading} />
          {isLoading ? (
            <>
              {uploadIconVariant ? (
                <RiUploadCloud2Line className="w-10 h-10" />
              ) : (
                <RiUploadCloudLine className="w-10 h-10" />
              )}
              <progress
                className="mt-4 progress progress-primary w-full mx-6 sm:mx-0 sm:w-9/12"
                value={progress === 100 ? undefined : progress}
                max={progress === 100 ? undefined : '100'}
              />
              <button
                className="btn btn-error btn-ghost btn-sm mt-8"
                onClick={onCancel}
                disabled={progress === 100}
              >
                Cancel upload
              </button>
            </>
          ) : (
            <>
              {isDragActive ? <RiDragDropLine className="w-10 h-10" /> : icons}
              <p className="mt-8 text-base text-center">{isDragActive ? 'Drop file here' : hint}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default UploadDropzone
