'use client'

import { useId } from 'react'
import { RiCloseLine } from 'react-icons/ri'

type Props = {
  children: React.ReactNode
  isOpen: Boolean
  showCloseButton?: Boolean
  hideOnOutsideClick?: Boolean
  onClose: () => void
}

export default function Modal(props: Props) {
  const id = useId()
  const { children, isOpen, showCloseButton, hideOnOutsideClick, onClose } = props

  if (!isOpen) {
    return null
  }

  return (
    <>
      <input
        type="checkbox"
        id={id}
        className="modal-toggle"
        defaultChecked
        disabled={!hideOnOutsideClick}
        onChange={onClose}
      />
      <div className="modal">
        <div className="modal-box">
          {showCloseButton ? (
            <div className="flex w-full flex-row-reverse -mt-3 mb-3">
              <button className="btn btn-sm -mr-3" onClick={onClose}>
                <RiCloseLine className="w-3 h-3" />
              </button>
            </div>
          ) : null}
          {children}
        </div>
        <label className="modal-backdrop" htmlFor={id}>
          Close
        </label>
      </div>
    </>
  )
}
