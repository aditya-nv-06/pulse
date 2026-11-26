import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api, ApiError, type Post, type PostStatus, type Workspace } from "../api"
import FounderNav from "./FounderNav"
import CopyBoardLink from "./CopyBoardLink"
import Pagination from "./Pagination"
import { pageItems } from "./pagination"

const labels: Record<PostStatus, string> = {
  OPEN: "Open",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
}
const statusStyles: Record<PostStatus, string> = {
  OPEN: "bg-sky-50 text-sky-700 ring-sky-600/20",
  PLANNED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  IN_PROGRESS: "bg-violet-50 text-violet-700 ring-violet-600/20",
  SHIPPED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
}
type PostFilter = "ALL" | "OPEN" | "PLANNED" | "IN_PROGRESS"
const PAGE_SIZE = 10

const PostsDashboard = () => {
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [filter, setFilter] = useState<PostFilter>("ALL")
  const [page, setPage] = useState(1)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState("")
  const [workspaceSlug, setWorkspaceSlug] = useState("")

  const loadWorkspace = async (selected: Workspace) => {
    setWorkspace(selected)
    try {
      const items = await api.getAdminPosts(selected.slug)
      setPosts(items)
      setError("")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load workspace settings")
      throw loadError
    }
  }
  useEffect(() => {
    queueMicrotask(() => {
      api
        .getWorkspaces()
        .then(async (items) => {
          setWorkspaces(items)
          if (items[0]) await loadWorkspace(items[0])
          else setError("No workspace is available for this account.")
        })
        .catch((loadError) => {
          if (loadError instanceof ApiError && loadError.message === "Session expired")
            navigate("/login")
          else
            setError(loadError instanceof Error ? loadError.message : "Unable to load workspaces")
        })
        .finally(() => setLoading(false))
    })
  }, [navigate])
  const switchWorkspace = (slug: string) => {
    const selected = workspaces.find((item) => item.slug === slug)
    if (selected) {
      setPage(1)
      void loadWorkspace(selected).catch(() => undefined)
    }
  }
  const changeStatus = async (post: Post, status: PostStatus) => {
    if (!workspace) return
    try {
      const updated = await api.updateStatus(workspace.slug, post.id, status)
      setPosts((items) => items.map((item) => (item.id === updated.id ? updated : item)))
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update status")
    }
  }
  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault()
    if (!workspaceName.trim() || !workspaceSlug.trim()) return
    try {
      const created = await api.createWorkspace(
        workspaceName.trim(),
        workspaceSlug.trim().toLowerCase(),
      )
      setWorkspaces((items) => [...items, created])
      await loadWorkspace(created)
      setModalOpen(false)
      setWorkspaceName("")
      setWorkspaceSlug("")
    } catch (workspaceError) {
      if (workspaceError instanceof ApiError && workspaceError.code === "UPGRADE_REQUIRED") {
        localStorage.setItem(
          "pulse_pending_workspace",
          JSON.stringify({ name: workspaceName.trim(), slug: workspaceSlug.trim().toLowerCase() }),
        )
        navigate("/payment")
      } else
        setError(
          workspaceError instanceof Error ? workspaceError.message : "Unable to create workspace",
        )
    }
  }

  const visiblePosts =
    filter === "ALL"
      ? posts.filter((post) => post.status !== "SHIPPED")
      : posts.filter((post) => post.status === filter)
  if (!workspace)
    return (
      <main className="grid min-h-screen place-items-center bg-[#FAFAF8] px-6">
        <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold">
            {loading ? "Loading your workspace..." : error || "Unable to load your workspace."}
          </p>
          {!loading && (
            <button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-[#625BF6] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
          )}
        </div>
      </main>
    )

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-neutral-950">
      <FounderNav
        workspace={workspace}
        workspaces={workspaces}
        onWorkspaceChange={switchWorkspace}
      />
      <main className="mx-auto max-w-6xl px-6 py-10 lg:ml-64">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold text-[#625BF6]">
              {workspace.name.toUpperCase()} / FEATURES
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Feature requests</h1>
            <p className="mt-2 text-neutral-500">
              Review feature requests, update their status, and reply to customers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CopyBoardLink
              slug={workspace.slug}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5"
            />
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-xl bg-[#625BF6] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Add workspace
            </button>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {(["ALL", "OPEN", "PLANNED", "IN_PROGRESS"] as const).map((value) => (
            <button
              key={value}
              onClick={() => {
                setFilter(value)
                setPage(1)
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === value ? "bg-neutral-950 text-white" : "bg-white text-neutral-500 ring-1 ring-neutral-200"}`}
            >
              {value === "ALL" ? "Active features" : labels[value]}
            </button>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="divide-y divide-neutral-100">
            {pageItems(visiblePosts, page, PAGE_SIZE).map((post) => (
              <article key={post.id} className="p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <Link
                      to={`/dashboard/posts/${post.id}?workspace=${workspace.slug}`}
                      className="text-lg font-bold hover:text-[#625BF6]"
                    >
                      {post.title}
                    </Link>
                    <div className="mt-2 flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[post.status]}`}
                      >
                        {labels[post.status]}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {post.votes} votes · by {post.author}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-neutral-500">{post.description}</p>
                    {post.meetingRequested && (
                      <p className="mt-3 inline-flex rounded-full bg-[#625BF6]/10 px-3 py-1.5 text-xs font-semibold text-[#625BF6]">
                        Meeting requested
                      </p>
                    )}
                  </div>
                  <select
                    value={post.status}
                    onChange={(event) => void changeStatus(post, event.target.value as PostStatus)}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <option value="OPEN">Open</option>
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="SHIPPED">Shipped</option>
                  </select>
                </div>
                <Link
                  to={`/dashboard/posts/${post.id}?workspace=${workspace.slug}`}
                  className="mt-4 inline-block text-sm font-semibold text-[#625BF6]"
                >
                  {post.meetingRequested ? "Review meeting request →" : "View feature details →"}
                </Link>
              </article>
            ))}
          </div>
          {visiblePosts.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-neutral-600">
                No active features in this view.
              </p>
              <Link
                to="/dashboard/analytics"
                className="mt-2 inline-block text-sm font-semibold text-[#625BF6]"
              >
                View shipped features in Analytics →
              </Link>
            </div>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={visiblePosts.length}
            onPageChange={setPage}
          />
        </div>
      </main>
      {modalOpen && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-neutral-950/35 p-6">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#625BF6]">
                  NEW WORKSPACE
                </p>
                <h2 className="mt-2 text-2xl font-bold">Create another workspace</h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="text-2xl text-neutral-400"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Your free plan includes one workspace. Upgrade when you are ready to add another.
            </p>
            <form onSubmit={createWorkspace} className="mt-6 space-y-3">
              <input
                required
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Workspace name"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-[#625BF6]"
              />
              <input
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={workspaceSlug}
                onChange={(event) => setWorkspaceSlug(event.target.value)}
                placeholder="workspace-slug"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-[#625BF6]"
              />
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button className="flex-1 rounded-xl bg-[#625BF6] px-4 py-3 text-sm font-semibold text-white">
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PostsDashboard
