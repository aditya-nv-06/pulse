import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api, ApiError, type MeetingRequestStatus, type Post, type Workspace } from "../api"
import FounderNav from "./FounderNav"
import Pagination from "./Pagination"
import { pageItems } from "./pagination"

const statusLabels = {
  OPEN: "Open",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
} as const
const requestStatusLabels: Record<MeetingRequestStatus, string> = {
  REQUESTED: "Requested",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
}
const requestStatusStyles: Record<MeetingRequestStatus, string> = {
  REQUESTED: "bg-[#625BF6]/10 text-[#625BF6]",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-neutral-100 text-neutral-600",
}
type RequestFilter = "ALL" | MeetingRequestStatus
const PAGE_SIZE = 10

const MeetingsDashboard = () => {
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [requests, setRequests] = useState<Post[]>([])
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<RequestFilter>("REQUESTED")
  const [page, setPage] = useState(1)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState("")
  const activeSlug = useRef<string | null>(null)

  const loadWorkspace = useCallback(
    async (selected: Workspace) => {
      activeSlug.current = selected.slug
      setWorkspace(selected)
      setError("")
      try {
        const [settings, items] = await Promise.all([
          api.getMeetingRequestSettings(selected.slug),
          api.getMeetingRequests(selected.slug),
        ])
        if (activeSlug.current !== selected.slug) return
        setEnabled(settings.enabled)
        setRequests(items)
      } catch (loadError) {
        if (activeSlug.current !== selected.slug) return
        if (loadError instanceof ApiError && loadError.message === "Session expired")
          navigate("/login")
        else
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load meeting requests",
          )
      }
    },
    [navigate],
  )

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
          else setError(loadError instanceof Error ? loadError.message : "Unable to load workspace")
        })
    })
  }, [loadWorkspace, navigate])

  const switchWorkspace = (slug: string) => {
    const selected = workspaces.find((item) => item.slug === slug)
    if (selected) void loadWorkspace(selected)
  }

  const toggleRequests = async () => {
    if (!workspace || saving) return
    const nextEnabled = !enabled
    setSaving(true)
    setEnabled(nextEnabled)
    setMessage("")
    setError("")
    try {
      const settings = await api.updateMeetingRequestSettings(workspace.slug, nextEnabled)
      if (activeSlug.current !== workspace.slug) return
      setEnabled(settings.enabled)
      setMessage(
        settings.enabled
          ? "Meeting requests are enabled. The toggle now appears on the public feature form."
          : "Meeting requests are disabled. The public feature form no longer shows the toggle.",
      )
    } catch (saveError) {
      if (activeSlug.current !== workspace.slug) return
      setEnabled(!nextEnabled)
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update meeting request settings",
      )
    } finally {
      if (activeSlug.current === workspace.slug) setSaving(false)
    }
  }

  const updateRequestStatus = async (request: Post, status: MeetingRequestStatus, note = "") => {
    if (!workspace || updatingId) return
    setUpdatingId(request.id)
    setError("")
    setMessage("")
    try {
      const updated = await api.updateMeetingRequest(workspace.slug, request.id, status, note)
      setRequests((items) => items.map((item) => (item.id === updated.id ? updated : item)))
      if (status !== "REQUESTED") {
        setFilter("REQUESTED")
        setPage(1)
      }
      setRejectingId(null)
      setResolutionNote("")
      setMessage(
        status === "COMPLETED"
          ? "Meeting marked as completed."
          : status === "REJECTED"
            ? "Meeting request rejected."
            : "Meeting request reopened.",
      )
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update this meeting request",
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const visibleRequests = requests.filter(
    (request) => filter === "ALL" || (request.meetingRequestStatus ?? "REQUESTED") === filter,
  )

  if (!workspace)
    return (
      <main className="grid min-h-screen place-items-center bg-[#FAFAF8] px-6">
        <p className="font-semibold">{error || "Loading meeting requests…"}</p>
      </main>
    )

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <FounderNav
        workspace={workspace}
        workspaces={workspaces}
        onWorkspaceChange={switchWorkspace}
      />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:ml-64">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold text-[#625BF6]">
              {workspace.name.toUpperCase()} / COMMUNITY
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Meeting requests</h1>
            <p className="mt-2 max-w-2xl text-[#525252]">
              See which people want to talk about a specific feature and review the details they
              shared.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Accept meeting requests</p>
              <p className="mt-1 text-xs text-[#A3A3A3]">
                Show an optional toggle on feature submissions
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-busy={saving}
              aria-label="Accept meeting requests"
              onClick={() => void toggleRequests()}
              disabled={saving}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#625BF6] disabled:cursor-wait disabled:opacity-60 ${enabled ? "bg-[#625BF6]" : "bg-neutral-300"}`}
            >
              <span
                aria-hidden="true"
                className={`size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        </div>
        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-[#625BF6]/10 px-4 py-3 text-sm font-medium text-[#625BF6]"
          >
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <section className="mt-7 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div
            className="mt-5 flex flex-wrap gap-2"
            role="group"
            aria-label="Filter meeting requests"
          >
            {(["ALL", "REQUESTED", "COMPLETED", "REJECTED"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value)
                  setPage(1)
                }}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === value ? "bg-[#171717] text-white" : "bg-[#FAFAF8] text-[#525252] hover:bg-neutral-100"}`}
              >
                {value === "ALL"
                  ? `All (${requests.length})`
                  : `${requestStatusLabels[value]} (${requests.filter((request) => (request.meetingRequestStatus ?? "REQUESTED") === value).length})`}
              </button>
            ))}
          </div>
          <div className="mt-2 divide-y divide-neutral-100">
            {pageItems(visibleRequests, page, PAGE_SIZE).map((request) => {
              const requestStatus = request.meetingRequestStatus ?? "REQUESTED"
              return (
                <article key={request.id} className="py-5 first:pt-4 last:pb-0">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold">{request.title}</h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${requestStatusStyles[requestStatus]}`}
                        >
                          {requestStatusLabels[requestStatus]}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-[#525252]">
                          Feature: {statusLabels[request.status]}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#525252]">
                        {request.description}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span className="font-semibold">{request.author}</span>
                        <a
                          href={`mailto:${request.authorEmail}`}
                          className="font-medium text-[#625BF6] hover:underline"
                        >
                          {request.authorEmail}
                        </a>
                        <span className="text-[#A3A3A3]">{request.votes} votes</span>
                        <span className="text-[#A3A3A3]">
                          Requested {new Date(request.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {request.meetingRequestResolutionNote && (
                        <p className="mt-3 rounded-xl bg-[#FAFAF8] p-3 text-sm leading-5 text-[#525252]">
                          <span className="font-semibold text-[#171717]">Founder note: </span>
                          {request.meetingRequestResolutionNote}
                        </p>
                      )}
                      {request.teamReply && (
                        <p className="mt-3 rounded-xl bg-[#FAFAF8] p-3 text-sm leading-5 text-[#525252]">
                          <span className="font-semibold text-[#171717]">Team reply: </span>
                          {request.teamReply}
                        </p>
                      )}
                      {rejectingId === request.id && (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault()
                            void updateRequestStatus(request, "REJECTED", resolutionNote)
                          }}
                          className="mt-4 max-w-xl"
                        >
                          <label className="text-sm font-semibold">
                            Reason for rejection
                            <textarea
                              required
                              minLength={3}
                              maxLength={500}
                              value={resolutionNote}
                              onChange={(event) => setResolutionNote(event.target.value)}
                              rows={2}
                              placeholder="Explain briefly why this request is being rejected"
                              className="mt-2 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#625BF6]"
                            />
                          </label>
                          <div className="mt-2 flex gap-2">
                            <button
                              disabled={
                                updatingId === request.id || resolutionNote.trim().length < 3
                              }
                              className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {updatingId === request.id ? "Saving…" : "Confirm rejection"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null)
                                setResolutionNote("")
                              }}
                              className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link
                        to={`/dashboard/posts/${request.id}?workspace=${encodeURIComponent(workspace.slug)}`}
                        className="inline-flex items-center justify-center rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold hover:border-[#625BF6] hover:text-[#625BF6]"
                      >
                        View feature
                      </Link>
                      {requestStatus === "REQUESTED" && (
                        <>
                          <button
                            type="button"
                            disabled={!!updatingId}
                            onClick={() => void updateRequestStatus(request, "COMPLETED")}
                            className="rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {updatingId === request.id ? "Saving…" : "Mark done"}
                          </button>
                          <button
                            type="button"
                            disabled={!!updatingId}
                            onClick={() => {
                              setRejectingId(request.id)
                              setResolutionNote("")
                            }}
                            className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm font-semibold text-[#525252] disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {requestStatus !== "REQUESTED" && (
                        <button
                          type="button"
                          disabled={!!updatingId}
                          onClick={() => void updateRequestStatus(request, "REQUESTED")}
                          className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm font-semibold text-[#525252] disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
            {visibleRequests.length === 0 && (
              <div className="rounded-2xl bg-[#FAFAF8] px-5 py-10 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-[#FAFAF8] text-xl text-[#625BF6]">
                  ◷
                </div>
                <p className="mt-4 font-semibold">
                  {requests.length
                    ? `No ${filter.toLowerCase()} meeting requests`
                    : "No meeting requests yet"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#A3A3A3]">
                  {requests.length
                    ? "Choose another filter to view requests."
                    : enabled
                      ? "When someone asks to discuss a feature, their details will appear here."
                      : "Enable meeting requests to let people ask for a conversation about a feature."}
                </p>
              </div>
            )}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={visibleRequests.length}
            onPageChange={setPage}
          />
        </section>
      </main>
    </div>
  )
}

export default MeetingsDashboard
