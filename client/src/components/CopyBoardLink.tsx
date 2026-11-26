import { useEffect, useRef, useState } from "react"

type CopyBoardLinkProps = { slug: string; className?: string }

const CopyBoardLink = ({ slug, className = "" }: CopyBoardLinkProps) => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardUrl = `${window.location.origin}/board/${slug}`

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(boardUrl)
      } else {
        const input = document.createElement("textarea")
        input.value = boardUrl
        input.setAttribute("readonly", "")
        input.style.position = "fixed"
        input.style.opacity = "0"
        document.body.append(input)
        input.select()
        const copiedToClipboard = document.execCommand("copy")
        input.remove()
        if (!copiedToClipboard) throw new Error("Copy failed")
      }
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`relative flex min-w-0 items-center gap-2 ${className}`}>
      <span title={boardUrl} className="min-w-0 truncate font-mono text-xs text-neutral-500">
        {boardUrl.replace(/^https?:\/\//, "")}
      </span>
      <button
        type="button"
        onClick={() => void copyLink()}
        aria-label="Copy public board link"
        title="Copy public board link"
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition hover:border-[#625BF6] hover:text-[#625BF6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#625BF6]"
      >
        {copied ? (
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path
              d="m4 10 4 4 8-8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <rect
              x="7"
              y="6"
              width="9"
              height="11"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M12 6V4.5A1.5 1.5 0 0 0 10.5 3h-6A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </button>
      {copied && (
        <span
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg bg-[#171717] px-3 py-2 text-xs font-semibold text-white shadow-lg"
        >
          Link copied
        </span>
      )}
    </div>
  )
}

export default CopyBoardLink
