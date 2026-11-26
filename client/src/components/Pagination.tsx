type PaginationProps = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
}

export const pageItems = <T,>(items: T[], page: number, pageSize: number) =>
  items.slice(
    (Math.min(page, Math.max(1, Math.ceil(items.length / pageSize))) - 1) * pageSize,
    Math.min(page, Math.max(1, Math.ceil(items.length / pageSize))) * pageSize,
  )

const Pagination = ({ page, pageSize, totalItems, onPageChange }: PaginationProps) => {
  const pageCount = Math.ceil(totalItems / pageSize)
  if (pageCount < 2) return null
  const currentPage = Math.min(page, pageCount)
  const firstItem = (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <nav
      aria-label="List pagination"
      className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-[#A3A3A3]">
        Showing {firstItem}–{lastItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-[#525252] hover:border-[#625BF6] hover:text-[#625BF6] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span
          aria-live="polite"
          className="min-w-20 text-center text-sm font-medium text-[#525252]"
        >
          Page {currentPage} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === pageCount}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-[#525252] hover:border-[#625BF6] hover:text-[#625BF6] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  )
}

export default Pagination
