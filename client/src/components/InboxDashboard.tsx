import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import {
  api,
  ApiError,
  type InboxItem,
  type InboxPostCandidate,
  type InboxSuggestion,
} from "../api"
import { useInboxUiStore } from "../stores/inboxUi"
import FounderNav from "./FounderNav"
import LoadingSpinner from "./LoadingSpinner"
import LoadingState from "./LoadingState"

type Tab = "NEW" | "DONE"
type ResolveInput =
  | { action: "link"; postId: string; suggestionIndex: number }
  | { action: "create"; title: string; body: string; suggestionIndex: number }
  | { action: "discard"; suggestionIndex: number }

const statusLabels: Record<InboxItem["status"], string> = {
  NEW: "New",
  LINKED: "Linked",
  CREATED: "Created",
  DISCARDED: "Discarded",
}

const statusStyles: Record<InboxItem["status"], string> = {
  NEW: "bg-amber-50 text-amber-700",
  LINKED: "bg-sky-50 text-sky-700",
  CREATED: "bg-emerald-50 text-emerald-700",
  DISCARDED: "bg-neutral-100 text-neutral-500",
}

const ErrorMessage = ({ message }: { message: string }) =>
  message ? (
    <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </p>
  ) : null

const SuggestionCard = ({
  item,
  suggestion,
  index,
  posts,
  postsLoading,
  busy,
  onResolve,
}: {
  item: InboxItem
  suggestion: InboxSuggestion
  index: number
  posts: InboxPostCandidate[]
  postsLoading: boolean
  busy: boolean
  onResolve: (input: ResolveInput) => void
}) => {
  const [title, setTitle] = useState(suggestion.title)
  const [summary, setSummary] = useState(suggestion.summary)
  const [postId, setPostId] = useState(suggestion.matchedPostId ?? "")
  const [postSearch, setPostSearch] = useState("")
  const selectedPost = posts.find((post) => post.id === postId)
  const filteredPosts = posts.filter((post) =>
    post.title.toLowerCase().includes(postSearch.trim().toLowerCase()),
  )
  const resolved = Boolean(suggestion.resolution)

  useEffect(() => {
    setTitle(suggestion.title)
    setSummary(suggestion.summary)
    setPostId(suggestion.matchedPostId ?? "")
  }, [suggestion.title, suggestion.summary, suggestion.matchedPostId])

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#625BF6]">
          Suggested request {index + 1}
        </p>
        {resolved && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Resolved
          </span>
        )}
      </div>
      <label className="mt-4 block text-xs font-semibold text-neutral-500">
        Title
        <input
          value={title}
          disabled={resolved || busy}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-semibold text-neutral-900 outline-none focus:border-[#625BF6]"
        />
      </label>
      <label className="mt-3 block text-xs font-semibold text-neutral-500">
        Summary
        <textarea
          value={summary}
          disabled={resolved || busy}
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
          maxLength={1000}
          className="mt-1.5 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal leading-6 text-neutral-700 outline-none focus:border-[#625BF6]"
        />
      </label>

      {suggestion.matchedPostId && (
        <p className="mt-3 text-xs font-semibold text-[#625BF6]">AI found a possible match</p>
      )}
      <div className="mt-3">
        <label
          className="block text-xs font-semibold text-neutral-500"
          htmlFor={`post-search-${item.id}-${index}`}
        >
          Attach to an existing post
        </label>
        <input
          id={`post-search-${item.id}-${index}`}
          type="search"
          value={postSearch}
          disabled={resolved || busy || postsLoading}
          onChange={(event) => {
            const value = event.target.value
            setPostSearch(value)
            if (
              selectedPost &&
              !selectedPost.title.toLowerCase().includes(value.trim().toLowerCase())
            )
              setPostId("")
          }}
          placeholder="Search posts by title"
          className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-[#625BF6]"
        />
        <select
          value={postId}
          disabled={resolved || busy || postsLoading}
          onChange={(event) => setPostId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal"
        >
          <option value="">Choose an existing post…</option>
          {filteredPosts.map((post) => (
            <option key={post.id} value={post.id}>
              {post.title} · {post.votes} votes
            </option>
          ))}
        </select>
      </div>

      {selectedPost && (
        <p className="mt-2 rounded-xl bg-[#FAFAF8] px-3 py-2 text-xs text-neutral-600">
          Match: <span className="font-semibold">{selectedPost.title}</span> · {selectedPost.votes}{" "}
          votes
        </p>
      )}
      {!postsLoading && posts.length === 0 && (
        <p className="mt-2 text-xs text-neutral-500">There are no open posts to link yet.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={resolved || busy || !selectedPost}
          onClick={() => onResolve({ action: "link", postId, suggestionIndex: index })}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#625BF6] px-3.5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <LoadingSpinner className="h-4 w-4" light />}
          {suggestion.matchedPostId && postId === suggestion.matchedPostId
            ? "Add to existing post"
            : "Link to selected post"}
        </button>
        <button
          type="button"
          disabled={resolved || busy || title.trim().length < 5}
          onClick={() =>
            onResolve({
              action: "create",
              title: title.trim(),
              body: summary.trim(),
              suggestionIndex: index,
            })
          }
          className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create new post
        </button>
        <button
          type="button"
          disabled={resolved || busy}
          onClick={() => onResolve({ action: "discard", suggestionIndex: index })}
          className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Discard
        </button>
      </div>
      {resolved && suggestion.resolution?.action !== "discard" && suggestion.resolution?.postId && (
        <p className="mt-3 text-xs text-neutral-500">
          Attached to post {suggestion.resolution.postId}
        </p>
      )}
      <span className="sr-only">Source item: {item.id}</span>
    </article>
  )
}

const InboxDashboard = () => {
  const { slug = "" } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const expandedItemId = useInboxUiStore((state) => state.expandedItemId)
  const setExpandedItemId = useInboxUiStore((state) => state.setExpandedItemId)
  const [tab, setTab] = useState<Tab>("NEW")
  const [rawText, setRawText] = useState("")
  const [requesterName, setRequesterName] = useState("")
  const [requesterEmail, setRequesterEmail] = useState("")
  const [sourceNote, setSourceNote] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [importSource, setImportSource] = useState<"PASTE" | "CSV">("PASTE")
  const [formError, setFormError] = useState("")
  const [notice, setNotice] = useState("")

  const workspacesQuery = useQuery({ queryKey: ["workspaces"], queryFn: api.getWorkspaces })
  const workspace = workspacesQuery.data?.find((item) => item.slug === slug)
  const itemsQuery = useInfiniteQuery({
    queryKey: ["inbox", slug, tab],
    queryFn: ({ pageParam }) => api.getInbox(slug, tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(workspace),
  })
  const postsQuery = useQuery({
    queryKey: ["inbox-posts", slug],
    queryFn: () => api.getInboxPosts(slug),
    enabled: Boolean(workspace),
    staleTime: 30_000,
  })
  const items = useMemo(
    () => itemsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [itemsQuery.data],
  )

  useEffect(() => {
    if (
      workspacesQuery.error instanceof ApiError &&
      workspacesQuery.error.message === "Session expired"
    )
      navigate("/login", { replace: true })
  }, [navigate, workspacesQuery.error])

  const invalidateInbox = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inbox", slug] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-count", slug] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-posts", slug] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.createInboxItem(slug, {
        rawText,
        requesterName: requesterName.trim() || undefined,
        requesterEmail: requesterEmail.trim() || undefined,
        sourceNote: sourceNote.trim() || undefined,
        source: "MANUAL",
      }),
    onSuccess: async (item) => {
      setRawText("")
      setRequesterName("")
      setRequesterEmail("")
      setSourceNote("")
      setNotice("Saved to your inbox")
      setFormError("")
      setTab("NEW")
      setExpandedItemId(item.id)
      await invalidateInbox()
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Unable to save feedback"),
  })
  const importMutation = useMutation({
    mutationFn: () => api.importInboxItems(slug, importText, importSource),
    onSuccess: async (result) => {
      setImportText("")
      setImportOpen(false)
      setNotice(
        `${result.items.length} feedback item${result.items.length === 1 ? "" : "s"} imported`,
      )
      setFormError("")
      setTab("NEW")
      await invalidateInbox()
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Unable to import feedback"),
  })
  const analyzeMutation = useMutation({
    mutationFn: (itemId: string) => api.analyzeInboxItem(slug, itemId),
    onSuccess: async (result) => {
      setExpandedItemId(result.id)
      setNotice("Feedback organized into suggested requests")
      setFormError("")
      await invalidateInbox()
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Unable to analyze feedback"),
  })
  const resolveMutation = useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: ResolveInput }) =>
      api.resolveInboxItem(slug, itemId, input),
    onSuccess: async () => {
      setNotice("Inbox suggestion resolved")
      setFormError("")
      await invalidateInbox()
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Unable to resolve suggestion"),
  })

  const submitQuickAdd = (event: FormEvent) => {
    event.preventDefault()
    setNotice("")
    setFormError("")
    if (!rawText.trim()) {
      setFormError("Paste or type feedback before saving it.")
      return
    }
    createMutation.mutate()
  }
  const quickAddShortcut = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  if (workspacesQuery.isLoading) return <LoadingState label="Loading your inbox…" />
  if (workspacesQuery.error)
    return <LoadingState label="We couldn’t load your workspaces. Please try again." error />
  if (!workspace)
    return <LoadingState label="This workspace isn’t available to your account." error />

  const itemsLoading = itemsQuery.isLoading
  const itemsError = itemsQuery.error instanceof Error ? itemsQuery.error.message : ""
  const newCount = itemsQuery.data?.pages[0]?.newCount ?? 0
  const resolveSuggestion = (itemId: string, input: ResolveInput) =>
    resolveMutation.mutate({ itemId, input })

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-neutral-950">
      <FounderNav
        workspace={workspace}
        workspaces={workspacesQuery.data ?? []}
        onWorkspaceChange={(nextSlug) => navigate(`/dashboard/${nextSlug}/inbox`)}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:ml-64">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.14em] text-[#625BF6]">
              {workspace.name} / INBOX
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Feedback inbox</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500 sm:text-base">
              Drop in a DM, email, or note. Turn each useful idea into a trackable request.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="shrink-0 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:border-[#625BF6] hover:text-[#625BF6]"
          >
            Import many
          </button>
        </div>

        <form
          onSubmit={submitQuickAdd}
          className="mt-7 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <label className="block text-sm font-semibold text-neutral-700" htmlFor="inbox-quick-add">
            Quick add
          </label>
          <textarea
            id="inbox-quick-add"
            required
            maxLength={5000}
            rows={5}
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            onKeyDown={quickAddShortcut}
            placeholder="Paste a DM, email or note…"
            className="mt-2 w-full resize-y rounded-2xl border border-neutral-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#625BF6] focus:ring-4 focus:ring-[#625BF6]/10"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-semibold text-neutral-500">
              From (name)
              <input
                value={requesterName}
                onChange={(event) => setRequesterName(event.target.value)}
                maxLength={120}
                placeholder="Optional"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal text-neutral-800 outline-none focus:border-[#625BF6]"
              />
            </label>
            <label className="text-xs font-semibold text-neutral-500">
              From (email)
              <input
                type="email"
                value={requesterEmail}
                onChange={(event) => setRequesterEmail(event.target.value)}
                maxLength={254}
                placeholder="Optional"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal text-neutral-800 outline-none focus:border-[#625BF6]"
              />
            </label>
            <label className="text-xs font-semibold text-neutral-500 sm:col-span-2 xl:col-span-1">
              Where from?
              <input
                value={sourceNote}
                onChange={(event) => setSourceNote(event.target.value)}
                maxLength={200}
                placeholder="e.g. Twitter DM"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal text-neutral-800 outline-none focus:border-[#625BF6]"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-neutral-400">Tip: press Ctrl/⌘ + Enter to save quickly.</p>
            <button
              type="submit"
              disabled={createMutation.isPending || !rawText.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#625BF6] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {createMutation.isPending && <LoadingSpinner className="h-4 w-4" light />}
              {createMutation.isPending ? "Saving…" : "Save to inbox"}
            </button>
          </div>
          <ErrorMessage message={formError} />
          {notice && (
            <p role="status" className="mt-3 text-sm text-emerald-700">
              {notice}
            </p>
          )}
        </form>

        <div className="mt-8 flex items-center gap-2 border-b border-neutral-200">
          {(["NEW", "DONE"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold ${tab === value ? "border-[#625BF6] text-[#625BF6]" : "border-transparent text-neutral-500 hover:text-neutral-900"}`}
            >
              {value === "NEW" ? `New${newCount ? ` (${newCount})` : ""}` : "Done"}
            </button>
          ))}
        </div>

        {itemsLoading ? (
          <div className="grid min-h-48 place-items-center">
            <div className="flex items-center gap-3 text-sm font-medium text-neutral-500">
              <LoadingSpinner /> Loading inbox…
            </div>
          </div>
        ) : itemsError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {itemsError}
            <button
              type="button"
              onClick={() => void itemsQuery.refetch()}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-12 text-center">
            <p className="font-semibold text-neutral-800">
              {tab === "NEW" ? "Your inbox is clear" : "Nothing resolved yet"}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              {tab === "NEW"
                ? "Save feedback here, then let AI organize it into requests."
                : "Linked, created, and discarded feedback will show here."}
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {items.map((item) => {
              const suggestions = item.suggestion?.requests ?? []
              const hasResolvedSuggestion = suggestions.some((suggestion) => suggestion.resolution)
              const expanded = expandedItemId === item.id
              const analyzing = analyzeMutation.isPending && analyzeMutation.variables === item.id
              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[item.status]}`}
                      >
                        {statusLabels[item.status]}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                        {item.source}
                      </span>
                      {item.sourceNote && (
                        <span className="text-xs text-neutral-400">from {item.sourceNote}</span>
                      )}
                      {(item.requesterName || item.requesterEmail) && (
                        <span className="max-w-full truncate rounded-full bg-[#625BF6]/10 px-2.5 py-1 text-xs font-semibold text-[#625BF6]">
                          {item.requesterName || item.requesterEmail}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-neutral-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700">
                      {item.rawText}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {tab === "NEW" && (
                        <button
                          type="button"
                          disabled={analyzing || resolveMutation.isPending || hasResolvedSuggestion}
                          onClick={() => analyzeMutation.mutate(item.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#625BF6] px-3.5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                        >
                          {analyzing && <LoadingSpinner className="h-4 w-4" light />}
                          {analyzing
                            ? "Analyzing…"
                            : hasResolvedSuggestion
                              ? "Finish resolving"
                              : suggestions.length
                                ? "Re-analyze"
                                : "Analyze"}
                        </button>
                      )}
                      {suggestions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedItemId(expanded ? null : item.id)}
                          className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          {expanded
                            ? "Hide suggestions"
                            : `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"}`}
                        </button>
                      )}
                    </div>
                    {suggestions.length > 0 && expanded && (
                      <div className="mt-5 space-y-4 border-t border-neutral-100 pt-5">
                        {suggestions.map((suggestion, index) => (
                          <SuggestionCard
                            key={`${item.id}-${index}`}
                            item={item}
                            suggestion={suggestion}
                            index={index}
                            posts={postsQuery.data ?? []}
                            postsLoading={postsQuery.isLoading}
                            busy={resolveMutation.isPending}
                            onResolve={(input) => resolveSuggestion(item.id, input)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
            {itemsQuery.hasNextPage && (
              <button
                type="button"
                disabled={itemsQuery.isFetchingNextPage}
                onClick={() => void itemsQuery.fetchNextPage()}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 disabled:opacity-60"
              >
                {itemsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </main>

      {importOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-neutral-950/40 p-4 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-import-title"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#625BF6]">
                  BULK INTAKE
                </p>
                <h2 id="inbox-import-title" className="mt-2 text-2xl font-bold">
                  Import many feedback items
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Paste messages separated by blank lines, or upload CSV content with text, name,
                  and email columns.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                aria-label="Close import dialog"
                className="shrink-0 rounded-lg px-2 text-2xl text-neutral-400 hover:bg-neutral-100"
              >
                ×
              </button>
            </div>
            <label className="mt-5 block text-xs font-semibold text-neutral-500">
              Import format
              <select
                value={importSource}
                onChange={(event) => setImportSource(event.target.value as "PASTE" | "CSV")}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal"
              >
                <option value="PASTE">Text separated by blank lines</option>
                <option value="CSV">CSV rows</option>
              </select>
            </label>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={10}
              maxLength={250_000}
              placeholder={
                importSource === "CSV"
                  ? "text,name,email\nAdd dark mode,Sam,sam@example.com"
                  : "Paste message one…\n\nPaste message two…"
              }
              className="mt-3 w-full resize-y rounded-2xl border border-neutral-200 px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-[#625BF6]"
            />
            {formError && <ErrorMessage message={formError} />}
            <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importMutation.isPending || !importText.trim()}
                onClick={() => importMutation.mutate()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#625BF6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {importMutation.isPending && <LoadingSpinner className="h-4 w-4" light />}
                {importMutation.isPending ? "Importing…" : "Import feedback"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default InboxDashboard
