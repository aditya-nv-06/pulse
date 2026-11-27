import { useEffect, useState, type FormEvent } from "react"
import { api, type Post, type PostStatus, type Workspace } from "./api"
import { useNavigate } from "react-router-dom"
import BrandMark from "./components/BrandMark"

const labels: Record<PostStatus, string> = {
  OPEN: "Open",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
}

const Home = () => {
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [filter, setFilter] = useState<PostStatus | "ALL">("ALL")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [replying, setReplying] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [changelogTitle, setChangelogTitle] = useState("")
  const [changelogBody, setChangelogBody] = useState("")
  const [error, setError] = useState("")

  const load = async () => {
    try {
      const current = await api.getWorkspace()
      setWorkspace(current)
      if (current) setPosts(await api.getAdminPosts(current.slug))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load workspace")
    }
  }
  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [])

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setWorkspace(await api.createWorkspace(name, slug))
      setName("")
      setSlug("")
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create workspace")
    }
  }

  const changeStatus = async (post: Post, status: PostStatus) => {
    if (!workspace) return
    const updated = await api.updateStatus(workspace.slug, post.id, status)
    setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
  }

  const saveReply = async (postId: string) => {
    if (!workspace || !reply.trim()) return
    const updated = await api.reply(workspace.slug, postId, reply)
    setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    setReplying(null)
    setReply("")
  }

  const mergePost = async (post: Post) => {
    if (!workspace) return
    const targetId = window.prompt("Enter the ID of the feature to keep")
    if (!targetId) return
    try {
      await api.merge(workspace.slug, post.id, targetId)
      setPosts((current) => current.filter((item) => item.id !== post.id))
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : "Unable to merge feature")
    }
  }

  const publishChangelog = async (event: FormEvent) => {
    event.preventDefault()
    if (!workspace) return
    try {
      await api.publishChangelog(
        workspace.slug,
        changelogTitle,
        changelogBody,
        posts.filter((post) => post.status === "SHIPPED").map((post) => post.id),
      )
      setChangelogTitle("")
      setChangelogBody("")
      setError("Changelog entry published")
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish changelog")
    }
  }

  const signOut = async () => {
    try {
      await api.logout()
      navigate("/login", { replace: true })
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to log out")
    }
  }

  if (!workspace)
    return (
      <main className="min-h-screen bg-[#FAFAF8] px-6 py-16 text-neutral-950">
        <div className="mx-auto max-w-lg rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold text-[#625BF6]">PULSE / SETUP</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Create your first workspace</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Give your feedback board a name and a public URL.
          </p>
          <form className="mt-8 space-y-4" onSubmit={createWorkspace}>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Workspace name"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-[#625BF6]"
            />
            <input
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="slug, e.g. acme"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-[#625BF6]"
            />
            <button className="w-full rounded-xl bg-[#625BF6] px-4 py-3 font-semibold text-white">
              Create workspace
            </button>
          </form>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </main>
    )

  const visiblePosts = filter === "ALL" ? posts : posts.filter((post) => post.status === filter)
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-neutral-950">
      <header className="flex flex-col gap-4 border-b border-neutral-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-lg font-bold">
            <BrandMark />
            Pulse
          </p>
          <p className="text-xs text-neutral-500">{workspace.name} / founder workspace</p>
        </div>
        <nav className="hidden items-center gap-1 rounded-xl bg-neutral-100 p-1 text-sm font-semibold text-neutral-500 sm:flex">
          <button
            onClick={() => navigate("/dashboard/posts")}
            className="rounded-lg bg-white px-4 py-2 text-neutral-950 shadow-sm"
          >
            Features
          </button>
          <button
            onClick={() =>
              document.getElementById("changelog-publisher")?.scrollIntoView({ behavior: "smooth" })
            }
            className="rounded-lg px-4 py-2 hover:text-neutral-950"
          >
            Changelog
          </button>
        </nav>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => navigate(`/board/${workspace.slug}`)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold"
          >
            View public board
          </button>
          <button onClick={() => void signOut()} className="px-3 text-sm text-neutral-500">
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold text-[#625BF6]">WORKSPACE / FEATURES</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Feature requests</h1>
            <p className="mt-2 text-neutral-500">Prioritize what matters and close the loop.</p>
          </div>
          <a href={`/board/${workspace.slug}`} className="text-sm font-semibold text-[#625BF6]">
            pulse.local/{workspace.slug} ↗
          </a>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {(["ALL", "OPEN", "PLANNED", "IN_PROGRESS", "SHIPPED"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === value ? "bg-neutral-950 text-white" : "bg-white text-neutral-500 ring-1 ring-neutral-200"}`}
            >
              {value === "ALL" ? "All features" : labels[value]}
            </button>
          ))}
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {visiblePosts.map((post) => (
            <article key={post.id} className="border-b border-neutral-100 p-5 last:border-0">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-bold">{post.title}</h2>
                    <span className="rounded-full bg-[#625BF6]/10 px-2.5 py-1 text-xs font-semibold text-[#625BF6]">
                      {labels[post.status]}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                    {post.description}
                  </p>
                  <p className="mt-3 text-xs text-neutral-400">
                    {post.votes} votes · by {post.author}
                  </p>
                </div>
                <div className="flex gap-2">
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
                  <button
                    onClick={() => void mergePost(post)}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-500"
                  >
                    Merge
                  </button>
                </div>
              </div>
              {post.teamReply && (
                <div className="mt-4 rounded-xl bg-[#FAFAF8] p-4 text-sm">
                  <span className="font-semibold">Team reply:</span> {post.teamReply}
                </div>
              )}
              <div className="mt-4">
                {replying === post.id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Write a public reply"
                      className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => void saveReply(post.id)}
                      className="rounded-lg bg-neutral-950 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Reply
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setReplying(post.id)}
                    className="text-sm font-semibold text-[#625BF6]"
                  >
                    {post.teamReply ? "Edit team reply" : "Reply as team"}
                  </button>
                )}
              </div>
            </article>
          ))}
          {visiblePosts.length === 0 && (
            <p className="p-10 text-center text-sm text-neutral-500">No features in this view.</p>
          )}
        </div>
        <form
          id="changelog-publisher"
          onSubmit={publishChangelog}
          className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5"
        >
          <p className="text-sm font-bold">Publish a changelog entry</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <input
              required
              value={changelogTitle}
              onChange={(event) => setChangelogTitle(event.target.value)}
              placeholder="Release title"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <input
              required
              value={changelogBody}
              onChange={(event) => setChangelogBody(event.target.value)}
              placeholder="What shipped?"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white">
              Publish
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default Home
