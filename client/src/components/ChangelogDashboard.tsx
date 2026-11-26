import { useEffect, useRef, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { api, type ChangelogEntry, type Post, type Workspace } from "../api"
import FounderNav from "./FounderNav"
import Pagination from "./Pagination"
import { pageItems } from "./pagination"
import LoadingState from "./LoadingState"

const PAGE_SIZE = 10

const ChangelogDashboard = () => {
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [page, setPage] = useState(1)
  const [shippedPosts, setShippedPosts] = useState<Post[]>([])
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const activeSlug = useRef<string | null>(null)

  const loadWorkspace = async (selected: Workspace) => {
    activeSlug.current = selected.slug
    setLoading(true)
    setError("")
    setWorkspace(selected)
    try {
      const [board, posts] = await Promise.all([
        api.getBoard(selected.slug),
        api.getAdminPosts(selected.slug),
      ])
      if (activeSlug.current !== selected.slug) return
      setEntries(board.changelog)
      setShippedPosts(posts.filter((post) => post.status === "SHIPPED"))
    } finally {
      if (activeSlug.current === selected.slug) setLoading(false)
    }
  }
  useEffect(() => {
    queueMicrotask(() => {
      api
        .getWorkspaces()
        .then(async (items) => {
          setWorkspaces(items)
          if (items[0]) await loadWorkspace(items[0])
          else {
            setError("No workspace is available for this account.")
            setLoading(false)
          }
        })
        .catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "Unable to load changelog")
          setLoading(false)
        })
    })
  }, [navigate])
  const switchWorkspace = (slug: string) => {
    const selected = workspaces.find((item) => item.slug === slug)
    if (selected) void loadWorkspace(selected)
  }
  const publish = async (event: FormEvent) => {
    event.preventDefault()
    if (!workspace) return
    try {
      const entry = await api.publishChangelog(workspace.slug, title, body, selectedPostIds)
      setEntries((items) => [entry, ...items])
      setTitle("")
      setBody("")
      setSelectedPostIds([])
      setMessage("Changelog entry published")
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish changelog")
    }
  }
  if (loading) return <LoadingState label="Loading changelog…" />

  if (!workspace) return <LoadingState label={error} error />
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-neutral-950">
      <FounderNav
        workspace={workspace}
        workspaces={workspaces}
        onWorkspaceChange={switchWorkspace}
      />
      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:ml-64 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <p className="text-sm font-bold text-[#625BF6]">
            {workspace.name.toUpperCase()} / CHANGELOG
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Product updates</h1>
          <p className="mt-2 text-neutral-500">
            Publish shipped work and close the loop with customers.
          </p>
          <div className="mt-8 space-y-6">
            {pageItems(entries, page, PAGE_SIZE).map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-neutral-200 bg-white p-6"
              >
                <p className="text-xs font-semibold text-neutral-400">
                  {new Date(entry.publishedAt).toLocaleDateString()}
                </p>
                <h2 className="mt-3 text-xl font-bold">{entry.title}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-500">
                  {entry.body}
                </p>
              </article>
            ))}
            {entries.length === 0 && (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-500">
                Your published updates will appear here.
              </div>
            )}
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={entries.length}
              onPageChange={setPage}
            />
          </div>
        </section>
        <aside>
          <form
            onSubmit={publish}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-bold">New changelog entry</p>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Release title"
              className="mt-5 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[#625BF6]"
            />
            <textarea
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Tell customers what shipped"
              rows={6}
              className="mt-3 w-full resize-none rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[#625BF6]"
            />
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-neutral-400">
                Link shipped features
              </p>
              {shippedPosts.map((post) => (
                <label
                  key={post.id}
                  className="mt-3 flex items-start gap-2 text-sm text-neutral-600"
                >
                  <input
                    type="checkbox"
                    checked={selectedPostIds.includes(post.id)}
                    onChange={(event) =>
                      setSelectedPostIds((ids) =>
                        event.target.checked
                          ? [...ids, post.id]
                          : ids.filter((id) => id !== post.id),
                      )
                    }
                    className="mt-1 accent-[#625BF6]"
                  />
                  {post.title}
                </label>
              ))}
            </div>
            <button className="mt-6 w-full rounded-xl bg-[#625BF6] px-4 py-3 text-sm font-semibold text-white">
              Publish update
            </button>
            {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </form>
        </aside>
      </main>
    </div>
  )
}

export default ChangelogDashboard
