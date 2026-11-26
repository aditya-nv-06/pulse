import { useEffect, useRef, useState, type FormEvent } from "react"
import { api, type Post, type PublicBoard as BoardData } from "../api"
import { useParams } from "react-router-dom"
import PublicBoardNav from "./PublicBoardNav"
import Pagination from "./Pagination"
import { pageItems } from "./pagination"

const statusLabel = {
  OPEN: "Open",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
} as const
const statusStyles = {
  OPEN: "bg-sky-50 text-sky-700 ring-sky-600/20",
  PLANNED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  IN_PROGRESS: "bg-violet-50 text-violet-700 ring-violet-600/20",
  SHIPPED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
} as const
const PAGE_SIZE = 10

const PublicBoard = () => {
  const { slug = "acme" } = useParams()
  const [board, setBoard] = useState<BoardData | null>(null)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"top" | "new">("top")
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [email, setEmail] = useState("")
  const [meetingRequested, setMeetingRequested] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const [message, setMessage] = useState("")

  const load = async () => {
    try {
      setBoard(await api.getBoard(slug, search, sort))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load board")
    }
  }
  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
    const refreshBoard = () => {
      void load()
    }
    window.addEventListener("focus", refreshBoard)
    return () => window.removeEventListener("focus", refreshBoard)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, search, sort])

  const submitPost = async (event: FormEvent) => {
    event.preventDefault()
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    try {
      await api.createPost(slug, title, description, email, meetingRequested)
      const submittedTitle = title
      setTitle("")
      setDescription("")
      setEmail("")
      setMeetingRequested(false)
      setShowForm(false)
      setMessage(
        meetingRequested
          ? `Your feature request “${submittedTitle}” is on the board, and the founder can see you’d like to discuss it.`
          : "Thanks. Your feature request is now on the board.",
      )
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit feature")
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  const vote = async (post: Post) => {
    try {
      const result = await api.vote(post.id)
      setBoard((current) =>
        current
          ? {
              ...current,
              posts: current.posts.map((item) =>
                item.id === post.id ? { ...item, votes: result.votes } : item,
              ),
            }
          : current,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to vote")
    }
  }

  const activePosts = (board?.posts ?? []).filter((post) => post.status !== "SHIPPED")

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-neutral-950">
      <PublicBoardNav />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.14em] text-[#625BF6]">
              {board?.workspace.name ?? slug}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">What should we build next?</h1>
            <p className="mt-3 max-w-xl text-neutral-500">
              Suggest a feature, vote on what matters, and follow along as it ships. No account
              required.
            </p>
          </div>
          <button
            onClick={() => {
              setMeetingRequested(false)
              setShowForm(true)
            }}
            className="rounded-xl bg-[#625BF6] px-5 py-3 text-sm font-semibold text-white"
          >
            Submit a feature
          </button>
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search features"
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 outline-none focus:border-[#625BF6]"
          />
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as "top" | "new")
              setPage(1)
            }}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm"
          >
            <option value="top">Most votes</option>
            <option value="new">Newest</option>
          </select>
        </div>
        {message && <p className="mt-4 text-sm text-[#625BF6]">{message}</p>}
        <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="divide-y divide-neutral-100">
            {pageItems(
              [...activePosts].sort((a, b) =>
                sort === "top"
                  ? b.votes - a.votes ||
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              ),
              page,
              PAGE_SIZE,
            ).map((post) => (
              <article key={post.id} className="flex gap-4 p-5 transition hover:bg-neutral-50">
                <button
                  onClick={() => void vote(post)}
                  className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-[#FAFAF8] text-sm font-bold hover:bg-[#625BF6]/10"
                >
                  <span className="text-lg">↑</span>
                  <span>{post.votes}</span>
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-bold">{post.title}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[post.status]}`}
                    >
                      {statusLabel[post.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">{post.description}</p>
                  <p className="mt-3 text-xs text-neutral-400">
                    by {post.author}
                    {post.teamReply ? " · Team replied" : ""}
                  </p>
                </div>
              </article>
            ))}
          </div>
          {board && activePosts.length === 0 && (
            <p className="p-10 text-center text-sm text-neutral-500">
              No active features match your search.
            </p>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={activePosts.length}
            onPageChange={setPage}
          />
        </div>
      </main>
      {showForm && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-neutral-950/30 p-6">
          <form
            onSubmit={submitPost}
            className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Suggest a feature</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={submitting}
                className="text-2xl text-neutral-400 disabled:opacity-50"
              >
                ×
              </button>
            </div>
            <div className="mt-6 space-y-3">
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Short title"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-[#625BF6]"
              />
              <textarea
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What would this help you do?"
                rows={4}
                className="w-full resize-none rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-[#625BF6]"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Your email for updates"
                autoComplete="email"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-[#625BF6]"
              />
              {board?.workspace.meetingRequestsEnabled && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={meetingRequested}
                  disabled={submitting}
                  onClick={() => setMeetingRequested((value) => !value)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-neutral-200 p-4 text-left disabled:opacity-60"
                >
                  <span>
                    <span className="block text-sm font-semibold">
                      Request a meeting about this feature
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500">
                      The founder will see this request and its details.
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${meetingRequested ? "bg-[#625BF6]" : "bg-neutral-300"}`}
                  >
                    <span
                      className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform duration-200 ${meetingRequested ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </span>
                </button>
              )}
            </div>
            <button
              disabled={submitting}
              className="mt-5 w-full rounded-xl bg-[#625BF6] px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Publish idea"}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default PublicBoard
