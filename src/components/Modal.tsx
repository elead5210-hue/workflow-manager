import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

export interface ModalProps {
  /** Heading of the dialog. It also names the dialog for assistive technology. */
  title: string
  /** Called when the user presses Escape, clicks the backdrop or uses the close button. */
  onClose: () => void
  /** Content of the dialog body. Give the element that should get focus first a `data-autofocus` attribute. */
  children: ReactNode
  /**
   * Content of the footer, normally the action buttons. Buttons that submit a
   * form in the body can point at it with their `form` attribute.
   */
  footer?: ReactNode
  /** Set to false to keep the dialog open when the backdrop is clicked, for example while saving. */
  closeOnBackdrop?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Accessible modal dialog shown in a portal over the page.
 *
 * Focus moves into the dialog when it opens (to the element marked
 * `data-autofocus`, or to the dialog itself), stays inside it while Tab is
 * used, and returns to the element that opened it when the dialog closes.
 * Escape and a click on the backdrop call `onClose`. The page behind the
 * dialog does not scroll while it is open.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  closeOnBackdrop = true,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  // Always call the latest onClose without re-running the focus effect below.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Move focus in on open, lock page scroll, and put everything back on close.
  useEffect(() => {
    const dialog = dialogRef.current
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const preferred = dialog?.querySelector<HTMLElement>('[data-autofocus]')
    if (preferred) preferred.focus()
    else dialog?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      if (opener && opener.isConnected) opener.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCloseRef.current()
      return
    }
    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    )
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Only a press that starts on the backdrop itself closes the dialog, so
  // selecting text inside the dialog and releasing outside it does not.
  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onCloseRef.current()
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}