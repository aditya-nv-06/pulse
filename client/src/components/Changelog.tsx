import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { api, type ChangelogEntry } from "../api"
import PublicBoardNav from "./PublicBoardNav"
import Pagination from "./Pagination"
import { pageItems } from "./pagination"
import LoadingState from "./LoadingState"
import LoadingSpinner from "./LoadingSpinner"

const PAGE_SIZE = 10

const Changelog = () => {
  const { slug = "acme" } = useParams()
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [page, setPage] = useState(1)
  const [workspaceName, setWorkspaceName] = useState(slug)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const loadedSlug = useRef<string | null>(null)
  const requestSequence = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current
    const isInitialLoad = loadedSlug.current !== slug
    if (isInitialLoad) setLoading(true)
    else setRefreshing(true)
    try {
      const board = await api.getChangelog(slug)
      if (requestId !== requestSequence.current) return
      loadedSlug.current = slug
      setEntries(board.entries)
      setWorkspaceName(board.workspace.name)
      setError("")
    } catch (loadError) {
      if (requestId === requestSequence.current)
        setError(loadError instanceof Error ? loadError.message : "Unable to load changelog")
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [slug])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    const refreshChangelog = () => {
      if (document.visibilityState === "visible") void load()
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 20_000)
    window.addEventListener("focus", refreshChangelog)
    document.addEventListener("visibilitychange", refreshChangelog)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshChangelog)
      document.removeEventListener("visibilitychange", refreshChangelog)
      requestSequence.current += 1
    }
  }, [load])

  if (loading && loadedSlug.current !== slug) return <LoadingState label="Loading release notes…" />

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-neutral-950">
      <PublicBoardNav />
      <main className="mx-auto max-w-4xl px-6 py-14">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[.14em] text-[#625BF6]">
            {workspaceName} / RELEASE NOTES
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">What’s new</h1>
          <p className="mt-3 text-neutral-500">A running record of what the team has shipped.</p>
        </div>
        <div className="mt-12 space-y-0">
          {refreshing && (
            <p
              role="status"
              aria-live="polite"
              className="mb-4 inline-flex items-center gap-2 text-xs text-neutral-500"
            >
              <LoadingSpinner className="h-3.5 w-3.5" /> Checking for updates…
            </p>
          )}
          {pageItems(entries, page, PAGE_SIZE).map((entry, index) => (
            <article
              key={entry.id}
              className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 pb-9 sm:grid-cols-[9rem_2rem_minmax(0,1fr)] sm:gap-x-5"
            >
              <div className="hidden pt-5 text-right text-xs font-semibold leading-5 text-[#A3A3A3] sm:block">
                {new Date(entry.publishedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div aria-hidden="true" className="relative flex justify-center">
                <span className="absolute bottom-0 top-0 w-px bg-[#625BF6]/20" />
                <span className="relative mt-5 size-3 rounded-full border-[3px] border-[#625BF6] bg-[#FAFAF8] ring-4 ring-[#625BF6]/10" />
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-semibold text-[#625BF6] sm:hidden">
                  {new Date(entry.publishedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight sm:mt-0 sm:text-2xl">
                  {entry.title}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-500">
                  {entry.body}
                </p>
              </div>
              {index < pageItems(entries, page, PAGE_SIZE).length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[15px] top-8 hidden w-px bg-[#625BF6]/20 sm:block"
                />
              )}
            </article>
          ))}
          {entries.length === 0 && !error && (
            <p className="rounded-2xl border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
              No releases published yet.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={entries.length}
            onPageChange={setPage}
          />
        </div>
      </main>
    </div>
  )
}

export default Changelog
