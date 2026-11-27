import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react"
import { Link } from "react-router-dom"
import {
  api,
  type BlueprintEdge,
  type BlueprintNode,
  type BlueprintPlan,
  type Workspace,
} from "../api"
import FounderNav from "./FounderNav"
import LoadingState from "./LoadingState"
import LoadingSpinner from "./LoadingSpinner"

const nodeColors: Record<BlueprintNode["type"], string> = {
  user: "#625BF6",
  service: "#171717",
  database: "#525252",
  external: "#A3A3A3",
  queue: "#625BF6",
  process: "#525252",
}
const canvasWidth = 1600
const canvasHeight = 1800
const cardWidth = 230
const cardHeight = 112

type Point = { x: number; y: number }

const fitNodesToCanvas = (items: BlueprintNode[], rotateLegacyLayout = false) => {
  if (!items.length) return items
  const positioned = items.map((node, index) => {
    const x = node.position?.x ?? (index % 4) * 280 + 80
    const y = node.position?.y ?? Math.floor(index / 4) * 180 + 80
    return { node, x: rotateLegacyLayout ? y : x, y: rotateLegacyLayout ? x : y }
  })
  const minX = Math.min(...positioned.map((item) => item.x))
  const minY = Math.min(...positioned.map((item) => item.y))
  const maxY = Math.max(...positioned.map((item) => item.y))
  const sourceHeight = Math.max(maxY - minY + cardHeight, cardHeight)
  const offsetY = Math.max(64, (canvasHeight - sourceHeight) / 2)
  return positioned.map(({ node, x, y }) => ({
    ...node,
    position: { x: Math.round(72 + x - minX), y: Math.round(offsetY + y - minY) },
  }))
}

const findOpenPosition = (items: BlueprintNode[], anchor: Point): Point => {
  const occupied = items.map((node, index) => ({
    x: node.position?.x ?? 80 + (index % 4) * 280,
    y: node.position?.y ?? 80 + Math.floor(index / 4) * 180,
  }))
  for (let index = 0; index < 800; index += 1) {
    const candidate = {
      x: anchor.x + Math.floor(index / 8) * 300,
      y: anchor.y + 150 + (index % 8) * 150,
    }
    if (
      occupied.every(
        (item) => Math.abs(item.x - candidate.x) >= 250 || Math.abs(item.y - candidate.y) >= 130,
      )
    )
      return candidate
  }
  return { x: anchor.x + 310, y: anchor.y + items.length * 150 }
}

const planToPayload = (text: string): BlueprintPlan => {
  const lines = text
    .split(/\n|\.(?=\s)/)
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    name: lines[0]?.slice(0, 120) ?? "Product plan",
    summary: text,
    targetUsers: "Users described in the product plan",
    coreFeatures: lines
      .slice(0, 12)
      .map((line) => line.slice(0, 180))
      .filter(Boolean),
    scale: "As described in the product plan",
    techStack: "Use the technology stack described in the product plan",
    constraints: "",
    integrations: "",
  }
}

const Blueprint = () => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [productPlan, setProductPlan] = useState("")
  const [nodes, setNodes] = useState<BlueprintNode[]>([])
  const [edges, setEdges] = useState<BlueprintEdge[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.82)
  const [panning, setPanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const canvasRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef(nodes)
  const needsCentering = useRef(false)
  const panStart = useRef<Point>({ x: 0, y: 0 })
  const panOrigin = useRef<Point>({ x: 0, y: 0 })

  const loadBlueprint = async (selected: Workspace) => {
    setFetching(true)
    setError("")
    try {
      const result = await api.getBlueprint(selected.slug)
      const isLegacyLayout = Boolean(
        result?.version && !result.version.note?.toLowerCase().includes("vertical"),
      )
      needsCentering.current = true
      setNodes(fitNodesToCanvas(result?.graph.nodes ?? [], isLegacyLayout))
      setEdges(result?.graph.edges ?? [])
      setSelectedId(null)
      setSelectedEdgeId(null)
      setConnectFrom(null)
      setPan({ x: 0, y: 0 })
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      api
        .getWorkspaces()
        .then(async (items) => {
          setWorkspaces(items)
          if (items[0]) {
            setWorkspace(items[0])
            await loadBlueprint(items[0])
          } else {
            setError("No workspace is available for this account.")
            setFetching(false)
          }
        })
        .catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "Unable to load workspace")
          setFetching(false)
        })
    })
  }, [])

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (fetching || !needsCentering.current || !nodes.length || !canvas) return

    const minX = Math.min(...nodes.map((node) => node.position?.x ?? 0))
    const maxX = Math.max(...nodes.map((node) => node.position?.x ?? 0))
    const minY = Math.min(...nodes.map((node) => node.position?.y ?? 0))
    const maxY = Math.max(...nodes.map((node) => node.position?.y ?? 0))
    const diagramCenterX = (minX + maxX + cardWidth) / 2
    const diagramCenterY = (minY + maxY + cardHeight) / 2

    setPan({
      x: canvas.clientWidth / 2 - 24 - diagramCenterX * zoom,
      y: canvas.clientHeight / 2 - 24 - diagramCenterY * zoom,
    })
    needsCentering.current = false
  }, [fetching, nodes, zoom])

  useEffect(() => {
    if (!workspace) return
    let active = true
    const syncPublicFeatures = async () => {
      try {
        const result = await api.getBlueprint(workspace.slug)
        if (!active || !result) return
        const remoteNodes = fitNodesToCanvas(result.graph.nodes)
        const currentIds = new Set(nodesRef.current.map((node) => node.id))
        const additions = remoteNodes.filter((node) => !currentIds.has(node.id))
        if (!additions.length) return
        const additionIds = new Set(additions.map((node) => node.id))
        setNodes((current) => [
          ...current,
          ...additions.filter((node) => !current.some((item) => item.id === node.id)),
        ])
        setEdges((current) => {
          const known = new Set(current.map((edge) => edge.id))
          const newConnections = result.graph.edges.filter(
            (edge) =>
              (additionIds.has(edge.source) || additionIds.has(edge.target)) && !known.has(edge.id),
          )
          return [...current, ...newConnections]
        })
        const featureCount = additions.filter((node) => node.id.startsWith("feature_")).length
        setMessage(
          featureCount
            ? `${featureCount} new public feature ${featureCount === 1 ? "request was" : "requests were"} added to the whiteboard`
            : "Public feedback architecture synced to the whiteboard",
        )
      } catch {
        // Keep the current canvas usable if background sync is temporarily unavailable.
      }
    }
    const timer = window.setInterval(() => {
      void syncPublicFeatures()
    }, 10000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [workspace])

  const switchWorkspace = (slug: string) => {
    const selected = workspaces.find((item) => item.slug === slug)
    if (selected) {
      setWorkspace(selected)
      setMessage("")
      void loadBlueprint(selected).catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load blueprint"),
      )
    }
  }

  const generate = async (event: FormEvent) => {
    event.preventDefault()
    if (!workspace || productPlan.trim().length < 20) return
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const result = await api.generateBlueprint(workspace.slug, planToPayload(productPlan.trim()))
      needsCentering.current = true
      setNodes(fitNodesToCanvas(result.graph.nodes))
      setEdges(result.graph.edges)
      setSelectedId(null)
      setSelectedEdgeId(null)
      setPan({ x: 0, y: 0 })
      setZoom(0.82)
      setMessage(`Blueprint version ${result.version.version} generated`)
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : "Unable to generate blueprint",
      )
    } finally {
      setLoading(false)
    }
  }

  const canvasPoint = (event: PointerEvent<HTMLDivElement>): Point => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return { x: 80, y: 80 }
    return {
      x: (event.clientX - bounds.left - pan.x - 24) / zoom,
      y: (event.clientY - bounds.top - pan.y - 24) / zoom,
    }
  }

  const moveNode = (event: PointerEvent<HTMLDivElement>, nodeId: string) => {
    const point = canvasPoint(event)
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              position: {
                x: Math.max(0, Math.min(canvasWidth - cardWidth, point.x - cardWidth / 2)),
                y: Math.max(0, Math.min(canvasHeight - cardHeight, point.y - 24)),
              },
            }
          : node,
      ),
    )
  }

  const selectNode = (nodeId: string) => {
    setSelectedId(nodeId)
    setSelectedEdgeId(null)
    if (!connectFrom) return
    if (connectFrom === nodeId) {
      setConnectFrom(null)
      return
    }
    const exists = edges.some((edge) => edge.source === connectFrom && edge.target === nodeId)
    if (!exists)
      setEdges((current) => [
        ...current,
        {
          id: `${connectFrom}-${nodeId}-${Date.now()}`,
          source: connectFrom,
          target: nodeId,
          label: "connects",
        },
      ])
    setConnectFrom(null)
  }

  const addNode = () => {
    const id = `component_${Date.now()}`
    const source = nodes.find((node) => node.type === "service") ?? nodes[0]
    const position = findOpenPosition(
      nodes,
      source?.position ?? {
        x: canvasWidth / 2 - cardWidth / 2 - pan.x / zoom,
        y: 80 - pan.y / zoom,
      },
    )
    setNodes((current) => [
      ...current,
      { id, label: "New component", type: "service", feature: "Describe this component", position },
    ])
    if (source)
      setEdges((current) => [
        ...current,
        { id: `auto_${source.id}_${id}`, source: source.id, target: id, label: "connected" },
      ])
    setSelectedId(id)
    setSelectedEdgeId(null)
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setNodes((current) => current.filter((node) => node.id !== selectedId))
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId),
    )
    setSelectedEdgeId(null)
    setSelectedId(null)
  }

  const deleteSelectedEdge = () => {
    if (!selectedEdgeId) return
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId))
    setSelectedEdgeId(null)
  }

  const save = async () => {
    if (!workspace || !nodes.length) return
    setSaving(true)
    setError("")
    try {
      const result = await api.saveBlueprint(workspace.slug, { nodes, edges })
      setMessage(`Blueprint version ${result.version.version} saved`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save blueprint")
    } finally {
      setSaving(false)
    }
  }

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-node]")) return
    setPanning(true)
    panStart.current = { x: event.clientX, y: event.clientY }
    panOrigin.current = pan
  }
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    if (panning)
      setPan({
        x: panOrigin.current.x + event.clientX - panStart.current.x,
        y: panOrigin.current.y + event.clientY - panStart.current.y,
      })
  }
  const stopPan = () => setPanning(false)

  const selectedNode = nodes.find((node) => node.id === selectedId)
  const positions = nodes.map((node) => ({ ...node, position: node.position ?? { x: 80, y: 80 } }))
  if (fetching) return <LoadingState label="Loading blueprint…" />

  if (!workspace) return <LoadingState label={error} error />

  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-neutral-950">
      <FounderNav
        workspace={workspace}
        workspaces={workspaces}
        onWorkspaceChange={switchWorkspace}
      />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:ml-64 lg:py-8">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-bold tracking-[.18em] text-[#625BF6]">
              {workspace.name.toUpperCase()} / SYSTEM DESIGN
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Architecture whiteboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
              Shape your product architecture, connect the moving parts, and keep customer requests
              in the same view.
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:gap-3 xl:w-max">
            <span className="inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#625BF6]" />
              Public requests sync automatically
            </span>
            <Link
              to="/dashboard/posts"
              className="inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-neutral-50"
            >
              Back to features
            </Link>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-5">
          <form
            onSubmit={generate}
            className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-[#625BF6]">
                  Start with context
                </p>
                <h2 className="mt-1 text-xl font-bold">Product plan</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Describe users, features, scale, stack, constraints, and integrations. Pulse will
                  lay out a connected system map.
                </p>
              </div>
              <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-[#625BF6]/10 text-lg text-[#625BF6] sm:grid">
                ✦
              </span>
            </div>
            <textarea
              required
              minLength={20}
              maxLength={5000}
              value={productPlan}
              onChange={(event) => setProductPlan(event.target.value)}
              placeholder="A resume analyzer for job seekers and recruiters. It accepts PDF uploads, scores resumes against roles, and sends results by email..."
              rows={7}
              className="mt-4 w-full resize-y rounded-2xl border border-neutral-200 bg-[#FAFAF8] px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#625BF6] focus:bg-white"
            />
            <div className="mt-4 flex flex-col gap-4 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-xs leading-5 text-neutral-500">
                <span className="font-semibold text-neutral-700">Live system map.</span> Components
                connect automatically. Select a line to disconnect it; public feature requests sync
                here as they arrive.
              </p>
              <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                <span className="text-xs text-neutral-400">{productPlan.length}/5000</span>
                <button
                  disabled={loading || productPlan.trim().length < 20}
                  className="rounded-xl bg-[#625BF6] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingSpinner className="h-4 w-4" light />
                      Building map…
                    </span>
                  ) : (
                    "Generate architecture"
                  )}
                </button>
              </div>
            </div>
            {message && (
              <p role="status" className="mt-4 text-sm text-neutral-600">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </form>

          <section className="min-w-0 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-neutral-200 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#171717] text-xl text-white">
                  ◇
                </span>
                <div>
                  <h2 className="font-bold">System map</h2>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {nodes.length} components <span className="mx-1 text-neutral-300">·</span>{" "}
                    {edges.length} connections
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={addNode}
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-xs font-semibold hover:bg-neutral-50"
                >
                  ＋ Component
                </button>
                <button
                  onClick={() => setConnectFrom(connectFrom ? null : selectedId)}
                  disabled={!selectedId && !connectFrom}
                  className={`rounded-xl px-3 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${connectFrom ? "bg-[#625BF6] text-white" : "border border-neutral-200 hover:bg-neutral-50"}`}
                >
                  {connectFrom ? "Select target" : "Connect"}
                </button>
                <button
                  onClick={deleteSelectedEdge}
                  disabled={!selectedEdgeId}
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-xs font-semibold hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Disconnect
                </button>
                <button
                  onClick={deleteSelected}
                  disabled={!selectedId}
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-xs font-semibold hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete component
                </button>
                <span className="hidden h-7 w-px bg-neutral-200 xl:block" />
                <div className="flex items-center gap-1 rounded-xl border border-neutral-200 p-1">
                  <button
                    aria-label="Zoom out"
                    onClick={() => setZoom((value) => Math.max(0.45, value - 0.1))}
                    className="grid size-8 place-items-center rounded-lg text-lg hover:bg-neutral-100"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-xs font-medium text-neutral-500">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    aria-label="Zoom in"
                    onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}
                    className="grid size-8 place-items-center rounded-lg text-lg hover:bg-neutral-100"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => void save()}
                  disabled={saving || !nodes.length}
                  className="rounded-xl bg-[#171717] px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save version"}
                </button>
              </div>
            </div>
            {selectedEdge && (
              <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-[#FAFAF8] px-4 py-2.5 text-xs sm:px-5">
                <p className="text-neutral-600">
                  Selected connection:{" "}
                  <span className="font-semibold text-neutral-900">
                    {selectedEdge.label || "connection"}
                  </span>
                </p>
                <button
                  onClick={deleteSelectedEdge}
                  className="font-semibold text-[#625BF6] hover:underline"
                >
                  Disconnect
                </button>
              </div>
            )}
            <div
              ref={canvasRef}
              onPointerDown={startPan}
              onPointerMove={movePan}
              onPointerUp={stopPan}
              onPointerLeave={stopPan}
              className={`relative h-[560px] overflow-hidden bg-[#FAFAF8] sm:h-[680px] ${panning ? "cursor-grabbing" : "cursor-grab"}`}
              style={{
                backgroundImage: "radial-gradient(#E5E5E1 1px, transparent 1px)",
                backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
                backgroundPosition: `${pan.x + 24}px ${pan.y + 24}px`,
              }}
            >
              <div
                className="absolute left-6 top-6"
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                <svg
                  width={canvasWidth}
                  height={canvasHeight}
                  className="absolute inset-0 overflow-visible"
                >
                  {edges.map((edge) => {
                    const source = positions.find((node) => node.id === edge.source)?.position
                    const target = positions.find((node) => node.id === edge.target)?.position
                    if (!source || !target) return null
                    const x1 = source.x + cardWidth / 2
                    const y1 = source.y + cardHeight / 2
                    const x2 = target.x + cardWidth / 2
                    const y2 = target.y + cardHeight / 2
                    const selected = selectedEdgeId === edge.id
                    return (
                      <g
                        key={edge.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Connection ${edge.label ?? "link"}; select to disconnect`}
                        className="cursor-pointer"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedEdgeId(edge.id)
                          setSelectedId(null)
                          setConnectFrom(null)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedEdgeId(edge.id)
                            setSelectedId(null)
                            setConnectFrom(null)
                          }
                        }}
                      >
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="transparent"
                          strokeWidth="16"
                          pointerEvents="stroke"
                        />
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={selected ? "#625BF6" : "#A3A3A3"}
                          strokeWidth={selected ? "3" : "2"}
                          strokeDasharray="5 5"
                          pointerEvents="none"
                        />
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 7}
                          fill="#525252"
                          fontSize="12"
                          textAnchor="middle"
                          pointerEvents="none"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )
                  })}
                </svg>
                {positions.map((node) => (
                  <div
                    key={node.id}
                    data-node="true"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      setDraggingId(node.id)
                      selectNode(node.id)
                    }}
                    onPointerMove={(event) => {
                      if (draggingId === node.id) moveNode(event, node.id)
                    }}
                    onPointerUp={() => setDraggingId(null)}
                    className="absolute w-[230px] select-none"
                    style={{ left: node.position.x, top: node.position.y }}
                  >
                    <div
                      className={`min-h-28 rounded-2xl border-2 border-l-4 bg-white p-4 shadow-[0_8px_24px_rgba(20,20,20,0.08)] transition-shadow hover:shadow-md ${selectedId === node.id ? "border-neutral-950 ring-2 ring-[#625BF6]/20" : "border-neutral-200"}`}
                      style={{ borderLeftColor: nodeColors[node.type] }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-[#FAFAF8] px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">
                          {node.type}
                        </span>
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: nodeColors[node.type] }}
                        />
                      </div>
                      <p className="mt-3 truncate text-sm font-bold">{node.label}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
                        {node.feature || "Add a feature description"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {nodes.length === 0 && (
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <div className="max-w-sm rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#625BF6]/10 text-2xl text-[#625BF6]">
                      ◇
                    </span>
                    <p className="mt-4 font-bold">Your system map starts here</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Generate an architecture from your product plan or add a feature request on
                      your public board to create the first connected nodes.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-between gap-2 border-t border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-400 sm:flex-row sm:items-center sm:px-5">
              <span>
                Drag the canvas to pan <span className="mx-1">·</span> Drag a component to move it
              </span>
              <span>Public feature requests sync automatically</span>
            </div>
          </section>
          {selectedNode && (
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.15em] text-neutral-400">
                    Component details
                  </p>
                  <h2 className="mt-1 text-lg font-bold">Edit selection</h2>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="Close component details"
                  className="rounded-lg px-2 py-1 text-xl leading-none text-neutral-400 hover:bg-neutral-100"
                >
                  ×
                </button>
              </div>
              <label className="mt-4 block text-xs font-semibold text-neutral-600">
                Name
                <input
                  value={selectedNode.label}
                  onChange={(event) =>
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedId ? { ...node, label: event.target.value } : node,
                      ),
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#625BF6]"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold text-neutral-600">
                Feature
                <input
                  value={selectedNode.feature ?? ""}
                  onChange={(event) =>
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedId ? { ...node, feature: event.target.value } : node,
                      ),
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#625BF6]"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold text-neutral-600">
                Type
                <select
                  value={selectedNode.type}
                  onChange={(event) =>
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedId
                          ? { ...node, type: event.target.value as BlueprintNode["type"] }
                          : node,
                      ),
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#625BF6]"
                >
                  <option value="user">User</option>
                  <option value="service">Service</option>
                  <option value="database">Database</option>
                  <option value="external">External</option>
                  <option value="queue">Queue</option>
                  <option value="process">Process</option>
                </select>
              </label>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default Blueprint
