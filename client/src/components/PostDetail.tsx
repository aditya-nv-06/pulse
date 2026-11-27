import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { api, type Post, type PostStatus, type Workspace } from "../api"
import FounderNav from "./FounderNav"
import LoadingState from "./LoadingState"

const labels: Record<PostStatus, string> = {
  OPEN: "Open",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
}
const statusStyles: Record<PostStatus, string> = {
  OPEN: "bg-sky-50 text-sky-700",
  PLANNED: "bg-amber-50 text-amber-700",
  IN_PROGRESS: "bg-violet-50 text-violet-700",
  SHIPPED: "bg-emerald-50 text-emerald-700",
}

const PostDetail = () => {
  const navigate = useNavigate()
  const { postId = "" } = useParams()
  const [searchParams] = useSearchParams()
  const workspaceSlug = searchParams.get("workspace")
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [post, setPost] = useState<Post | null>(null)
  const [reply, setReply] = useState("")
  const [error, setError] = useState("")

  const load = async () => {
    setPost(null)
    setError("")
    try {
      const availableWorkspaces = await api.getWorkspaces()
      setWorkspaces(availableWorkspaces)
      const currentWorkspace =
        availableWorkspaces.find((item) => item.slug === workspaceSlug) ??
        (await api.getWorkspace())
      if (!currentWorkspace) {
        navigate("/dashboard/posts")
        return
      }
      setWorkspace(currentWorkspace)
      setPost(await api.getAdminPost(currentWorkspace.slug, postId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load feature request")
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
    // This page reloads when the selected workspace or feature id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, postId, workspaceSlug])

  const changeStatus = async (status: PostStatus) => {
    if (!workspace || !post) return
    try {
      setPost(await api.updateStatus(workspace.slug, post.id, status))
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update status")
    }
  }

  const saveReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!workspace || !post || !reply.trim()) return
    try {
      setPost(await api.reply(workspace.slug, post.id, reply))
      setReply("")
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Unable to save reply")
    }
  }

  const switchWorkspace = (slug: string) => {
    if (workspaces.some((item) => item.slug === slug))
      navigate(`/dashboard/posts/${postId}?workspace=${encodeURIComponent(slug)}`, {
        replace: true,
      })
  }

  if ((!post || !workspace) && !error) return <LoadingState label="Loading feature request…" />

  if (!post || !workspace)
    return (
      <main className="grid min-h-screen place-items-center bg-[#FAFAF8] px-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <p className="font-semibold">
            {error ? "Unable to open this feature" : "Loading feature request…"}
          </p>
          {error && (
            <>
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
              <Link
                to="/dashboard/posts"
                className="mt-4 inline-block text-sm font-semibold text-[#625BF6]"
              >
                Back to features
              </Link>
            </>
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
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10 lg:ml-64">
        <Link to="/dashboard/posts" className="text-sm font-semibold text-[#625BF6]">
          ← Back to features
        </Link>
        <article className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#625BF6]">
                Feature request
              </p>
              <h1 className="mt-3 break-words text-3xl font-bold tracking-tight">{post.title}</h1>
              <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-7 text-neutral-500">
                {post.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={`rounded-full px-3 py-2 text-xs font-semibold ${statusStyles[post.status]}`}
              >
                {labels[post.status]}
              </span>
              <label className="sr-only" htmlFor="feature-status">
                Update request status
              </label>
              <select
                id="feature-status"
                value={post.status}
                onChange={(event) => void changeStatus(event.target.value as PostStatus)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="OPEN">Open</option>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="SHIPPED">Shipped</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-5 text-sm">
            <span className="font-semibold">{post.author}</span>
            {post.authorEmail && (
              <a
                href={`mailto:${post.authorEmail}`}
                className="font-medium text-[#625BF6] hover:underline"
              >
                {post.authorEmail}
              </a>
            )}
            <span className="text-neutral-500">{post.votes} votes</span>
            <span className="text-neutral-400">
              Submitted {new Date(post.createdAt).toLocaleString()}
            </span>
          </div>
          {post.meetingRequested && (
            <section className="mt-6 rounded-2xl border border-[#625BF6]/20 bg-[#625BF6]/5 p-5">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#625BF6]" />
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#625BF6]">
                  Meeting requested for this feature
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                {post.author} asked to meet about “{post.title}”. Their email and the full feature
                details are shown above.
              </p>
            </section>
          )}
          {post.teamReply && (
            <div className="mt-6 rounded-xl bg-[#FAFAF8] p-4 text-sm leading-6">
              <p className="font-semibold">Team reply</p>
              <p className="mt-1">{post.teamReply}</p>
            </div>
          )}
          <form onSubmit={saveReply} className="mt-7 border-t border-neutral-100 pt-6">
            <label htmlFor="team-reply" className="text-sm font-bold">
              Reply as the team
            </label>
            <textarea
              id="team-reply"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Share an update with everyone following this request"
              rows={4}
              className="mt-3 w-full resize-y rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[#625BF6]"
            />
            <button className="mt-3 rounded-xl bg-[#625BF6] px-5 py-3 text-sm font-semibold text-white">
              Save reply
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </article>
      </main>
    </div>
  )
}

export default PostDetail
