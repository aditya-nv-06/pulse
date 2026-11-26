import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api, ApiError, type Workspace, type WorkspaceAnalytics } from "../api"
import FounderNav from "./FounderNav"
import Pagination from "./Pagination"
import { pageItems } from "./pagination"
import LoadingState from "./LoadingState"
import { m, useReducedMotion } from "framer-motion"
import LoadingSpinner from "./LoadingSpinner"

type Range = 7 | 30 | 90
type Metric = "requests" | "votes" | "meetingRequests"
const ranges: Range[] = [7, 30, 90]
const PAGE_SIZE = 10
const metricLabels: Record<Metric, string> = {
  requests: "New features",
  votes: "Votes",
  meetingRequests: "Meeting requests",
}
const statusLabels = {
  OPEN: "Open",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
} as const
const statusColors = {
  OPEN: "bg-[#A3A3A3]",
  PLANNED: "bg-amber-400",
  IN_PROGRESS: "bg-[#625BF6]",
  SHIPPED: "bg-emerald-500",
} as const

const LineChart = ({ data, metric }: { data: WorkspaceAnalytics["trends"]; metric: Metric }) => {
  const width = 760
  const height = 250
  const padding = { top: 20, right: 20, bottom: 34, left: 34 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const values = data.map((point) => point[metric])
  const max = Math.max(1, ...values)
  const points = values.map((value, index) => ({
    x: padding.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth),
    y: padding.top + plotHeight - (value / max) * plotHeight,
    value,
  }))
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ")
  const area = `${line} L${padding.left + plotWidth},${padding.top + plotHeight} L${padding.left},${padding.top + plotHeight} Z`
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div
      className="w-full overflow-hidden"
      role="img"
      aria-label={`${metricLabels[metric]} chart across the selected period`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="analytics-line-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#625BF6" stopOpacity=".18" />
            <stop offset="100%" stopColor="#625BF6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((index) => {
          const y = padding.top + (index * plotHeight) / 3
          const label = Math.round(max * (1 - index / 3))
          return (
            <g key={index}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + plotWidth}
                y2={y}
                stroke="#E5E5E5"
                strokeDasharray="4 5"
              />
              <text x={padding.left - 9} y={y + 4} textAnchor="end" fill="#A3A3A3" fontSize="10">
                {label}
              </text>
            </g>
          )
        })}
        <path d={area} fill="url(#analytics-line-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#625BF6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <g key={data[index]?.date}>
            <circle
              cx={point.x}
              cy={point.y}
              r={data.length < 20 ? 4 : 2.5}
              fill="#fff"
              stroke="#625BF6"
              strokeWidth="2"
            />
            <title>{`${data[index]?.date}: ${point.value} ${metricLabels[metric].toLowerCase()}`}</title>
          </g>
        ))}
        {data.map((point, index) =>
          index % labelEvery === 0 || index === data.length - 1 ? (
            <text
              key={point.date}
              x={points[index]?.x}
              y={height - 9}
              textAnchor="middle"
              fill="#A3A3A3"
              fontSize="10"
            >
              {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

const changeLabel = (current: number, previous: number) =>
  previous === 0
    ? current
      ? "New"
      : "0%"
    : `${current > previous ? "+" : ""}${Math.round(((current - previous) / previous) * 100)}%`

const AnalyticsDashboard = () => {
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [analytics, setAnalytics] = useState<WorkspaceAnalytics | null>(null)
  const [days, setDays] = useState<Range>(30)
  const [metric, setMetric] = useState<Metric>("requests")
  const [shippedPage, setShippedPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const activeSlug = useRef<string | null>(null)

  const loadAnalytics = useCallback(
    async (slug: string, range: Range) => {
      const requestKey = `${slug}:${range}`
      activeSlug.current = requestKey
      setLoading(true)
      setError("")
      try {
        const result = await api.getAnalytics(slug, range)
        if (activeSlug.current === requestKey) setAnalytics(result)
      } catch (loadError) {
        if (activeSlug.current !== requestKey) return
        if (loadError instanceof ApiError && loadError.message === "Session expired")
          navigate("/login")
        else setError(loadError instanceof Error ? loadError.message : "Unable to load analytics")
      } finally {
        if (activeSlug.current === requestKey) setLoading(false)
      }
    },
    [navigate],
  )

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      api
        .getWorkspaces()
        .then((items) => {
          if (cancelled) return
          setWorkspaces(items)
          const selected = items[0]
          if (!selected) {
            setError("No workspace is available for this account.")
            setLoading(false)
            return
          }
          setWorkspace(selected)
        })
        .catch((loadError) => {
          if (cancelled) return
          if (loadError instanceof ApiError && loadError.message === "Session expired")
            navigate("/login")
          else
            setError(loadError instanceof Error ? loadError.message : "Unable to load workspaces")
          setLoading(false)
        })
    })
    return () => {
      cancelled = true
      activeSlug.current = null
    }
  }, [navigate])

  useEffect(() => {
    if (!workspace) return
    const requestKey = `${workspace.slug}:${days}`
    queueMicrotask(() => {
      if (activeSlug.current !== requestKey) void loadAnalytics(workspace.slug, days)
    })
    return () => {
      if (activeSlug.current === requestKey) activeSlug.current = null
    }
  }, [days, loadAnalytics, workspace])

  const switchWorkspace = (slug: string) => {
    const selected = workspaces.find((item) => item.slug === slug)
    if (!selected) return
    setWorkspace(selected)
  }

  const cards = useMemo(
    () =>
      analytics
        ? [
            {
              label: "New features",
              value: analytics.current.requests,
              change: changeLabel(analytics.current.requests, analytics.previous.requests),
              sub: `vs previous ${days} days`,
            },
            {
              label: "Votes received",
              value: analytics.current.votes,
              change: changeLabel(analytics.current.votes, analytics.previous.votes),
              sub: `vs previous ${days} days`,
            },
            {
              label: "Meeting requests",
              value: analytics.current.meetingRequests,
              change: changeLabel(
                analytics.current.meetingRequests,
                analytics.previous.meetingRequests,
              ),
              sub: `vs previous ${days} days`,
            },
            {
              label: "Reply rate",
              value: `${analytics.summary.replyRate}%`,
              change: `${analytics.summary.totalRequests} total requests`,
              sub: "with a team reply",
            },
          ]
        : [],
    [analytics, days],
  )

  if (loading && !analytics) return <LoadingState label="Loading analytics…" />

  if (!workspace)
    return (
      <main className="grid min-h-screen place-items-center bg-[#FAFAF8] px-6">
        <p role="alert" className="font-semibold">
          {error}
        </p>
      </main>
    )

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <FounderNav
        workspace={workspace}
        workspaces={workspaces}
        onWorkspaceChange={switchWorkspace}
      />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:ml-64">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold text-[#625BF6]">
              {workspace.name.toUpperCase()} / ANALYTICS
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Workspace analytics</h1>
            <p className="mt-2 text-[#525252]">
              Understand what your community asks for and how your team responds.
            </p>
          </div>
          <div
            className="inline-flex w-fit rounded-xl border border-neutral-200 bg-white p-1"
            aria-label="Analytics date range"
          >
            {ranges.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={days === range}
                onClick={() => setDays(range)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${days === range ? "bg-[#625BF6] text-white" : "text-[#525252] hover:bg-neutral-100"}`}
              >
                {range}d
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-[#525252]">{card.label}</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <p className="text-3xl font-bold tracking-tight">{loading ? "—" : card.value}</p>
                <span className="rounded-full bg-[#625BF6]/10 px-2.5 py-1 text-xs font-bold text-[#625BF6]">
                  {card.change}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#A3A3A3]">{card.sub}</p>
            </article>
          ))}
        </div>
        <section className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#625BF6]">
                Activity over time
              </p>
              <h2 className="mt-1 text-xl font-bold">Daily activity</h2>
            </div>
            <div
              className="inline-flex w-fit rounded-xl bg-[#FAFAF8] p-1"
              aria-label="Choose chart metric"
            >
              {(["requests", "votes", "meetingRequests"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={metric === key}
                  onClick={() => setMetric(key)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${metric === key ? "bg-white text-[#625BF6] shadow-sm" : "text-[#525252] hover:text-[#171717]"}`}
                >
                  {metricLabels[key]}
                </button>
              ))}
            </div>
          </div>
          {loading && !analytics ? (
            <m.div
              className="mt-8 grid h-64 place-items-center rounded-2xl bg-[#FAFAF8]"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              aria-busy="true"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-neutral-500">
                <LoadingSpinner />
                Loading activity…
              </div>
            </m.div>
          ) : analytics ? (
            analytics.trends.some((point) => point[metric] > 0) ? (
              <div className="mt-6">
                <LineChart data={analytics.trends} metric={metric} />
                <p className="mt-2 text-center text-xs text-[#A3A3A3]">
                  Dates use UTC. Counts update as activity is recorded.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid h-64 place-items-center rounded-2xl bg-[#FAFAF8]">
                <div className="text-center">
                  <p className="font-semibold">
                    No {metricLabels[metric].toLowerCase()} in this period
                  </p>
                  <p className="mt-1 text-sm text-[#A3A3A3]">
                    Activity will appear here as it comes in.
                  </p>
                </div>
              </div>
            )
          ) : null}
        </section>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#625BF6]">
                Feedback health
              </p>
              <h2 className="mt-1 text-xl font-bold">Request status</h2>
              <p className="mt-1 text-sm text-[#A3A3A3]">
                {analytics?.summary.totalRequests ?? 0} active features across all time
              </p>
            </div>
            <div className="mt-6 space-y-5">
              {(Object.keys(statusLabels) as (keyof typeof statusLabels)[]).map((status) => {
                const count = analytics?.summary.statuses[status] ?? 0
                const total = analytics?.summary.totalRequests ?? 0
                const percentage = total ? (count / total) * 100 : 0
                return (
                  <div key={status}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#525252]">{statusLabels[status]}</span>
                      <span className="font-bold">
                        {count}
                        <span className="ml-2 font-normal text-[#A3A3A3]">
                          {Math.round(percentage)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full rounded-full transition-all ${statusColors[status]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
          <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#625BF6]">
                Community signal
              </p>
              <h2 className="mt-1 text-xl font-bold">Most voted features</h2>
              <p className="mt-1 text-sm text-[#A3A3A3]">Ranked by votes across all time</p>
            </div>
            <div className="mt-5 divide-y divide-neutral-100">
              {analytics?.topFeatures.map((feature, index) => {
                const maxVotes = Math.max(1, ...analytics.topFeatures.map((item) => item.votes))
                return (
                  <article key={feature.id} className="py-4 first:pt-0">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#FAFAF8] text-xs font-bold text-[#A3A3A3]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{feature.title}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full bg-[#625BF6]"
                            style={{ width: `${(feature.votes / maxVotes) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-[#525252]">
                        {feature.votes} votes
                      </span>
                    </div>
                  </article>
                )
              })}
              {analytics?.topFeatures.length === 0 && (
                <div className="rounded-2xl bg-[#FAFAF8] p-6 text-center text-sm text-[#A3A3A3]">
                  No feature requests yet.
                </div>
              )}
            </div>
          </section>
        </div>
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-[#525252]">Total votes</p>
            <p className="mt-2 text-2xl font-bold">{analytics?.summary.totalVotes ?? 0}</p>
            <p className="mt-1 text-xs text-[#A3A3A3]">Across all features</p>
          </article>
          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-[#525252]">In progress</p>
            <p className="mt-2 text-2xl font-bold">
              {analytics?.summary.statuses.IN_PROGRESS ?? 0}
            </p>
            <p className="mt-1 text-xs text-[#A3A3A3]">Features the team is building</p>
          </article>
          <article className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-[#525252]">Shipped</p>
            <p className="mt-2 text-2xl font-bold">{analytics?.summary.statuses.SHIPPED ?? 0}</p>
            <p className="mt-1 text-xs text-[#A3A3A3]">Features delivered to customers</p>
          </article>
        </section>
        <section className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#625BF6]">
                Delivered
              </p>
              <h2 className="mt-1 text-xl font-bold">Shipped features</h2>
              <p className="mt-1 text-sm text-[#A3A3A3]">
                Features are archived here when their status is changed to Shipped.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              {analytics?.shippedFeatures.length ?? 0} shipped
            </span>
          </div>
          <div className="mt-5 divide-y divide-neutral-100">
            {pageItems(analytics?.shippedFeatures ?? [], shippedPage, PAGE_SIZE).map((feature) => (
              <article
                key={feature.id}
                className="flex flex-col justify-between gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{feature.title}</h3>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Shipped
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#525252]">
                    {feature.description}
                  </p>
                  <p className="mt-3 text-xs text-[#A3A3A3]">
                    Shipped {new Date(feature.shippedAt).toLocaleDateString()} · {feature.votes}{" "}
                    {feature.votes === 1 ? "vote" : "votes"}
                  </p>
                </div>
                <Link
                  to={`/dashboard/posts/${feature.id}?workspace=${encodeURIComponent(workspace.slug)}`}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold hover:border-[#625BF6] hover:text-[#625BF6]"
                >
                  View feature
                </Link>
              </article>
            ))}
            {analytics?.shippedFeatures.length === 0 && (
              <div className="rounded-2xl bg-[#FAFAF8] px-5 py-9 text-center">
                <p className="font-semibold">Nothing shipped yet</p>
                <p className="mt-1 text-sm text-[#A3A3A3]">
                  When a feature is marked Shipped, it will be archived here.
                </p>
              </div>
            )}
          </div>
          <Pagination
            page={shippedPage}
            pageSize={PAGE_SIZE}
            totalItems={analytics?.shippedFeatures.length ?? 0}
            onPageChange={setShippedPage}
          />
        </section>
      </main>
    </div>
  )
}

export default AnalyticsDashboard
