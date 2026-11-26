import { prisma } from "../db.js"
import type { BlueprintGraph } from "../lib/blueprint.js"

type FeatureRequest = { id: string; title: string; description: string }

type BlueprintNode = BlueprintGraph["nodes"][number]
type BlueprintEdge = BlueprintGraph["edges"][number]

const initialNodes: BlueprintNode[] = [
  {
    id: "public_customers",
    label: "Customers",
    type: "user",
    feature: "Share ideas and vote on product features",
    position: { x: 80, y: 220 },
  },
  {
    id: "public_board",
    label: "Public feedback board",
    type: "service",
    feature: "Collects feature requests from customers",
    position: { x: 390, y: 220 },
  },
]
const initialEdges: BlueprintEdge[] = [
  {
    id: "customers-to-board",
    source: "public_customers",
    target: "public_board",
    label: "share ideas",
  },
]

export const addFeedbackFeatureToBlueprint = async (
  workspaceId: string,
  feature: FeatureRequest,
) => {
  const nodeId = `feature_${feature.id}`

  await prisma.$transaction(async (transaction) => {
    let blueprint = await transaction.blueprint.findUnique({
      where: { workspaceId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    })

    let nodes: BlueprintNode[]
    let edges: BlueprintEdge[]
    let versionNumber: number

    if (!blueprint) {
      blueprint = await transaction.blueprint.create({
        data: {
          workspaceId,
          planInput: {
            name: "Customer feedback architecture",
            summary: "Architecture created automatically from public feature requests.",
            targetUsers: "Customers sharing product feedback",
            coreFeatures: [feature.title.slice(0, 180)],
            scale: "",
            techStack: "",
            constraints: "",
            integrations: "",
          },
          versions: {
            create: {
              version: 1,
              nodes: initialNodes,
              edges: initialEdges,
              note: "Created from public feature request",
            },
          },
        },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      })
      nodes = initialNodes
      edges = initialEdges
      versionNumber = 2
    } else {
      const latest = blueprint.versions[0]
      nodes = (latest?.nodes ?? initialNodes) as BlueprintNode[]
      edges = (latest?.edges ?? initialEdges) as BlueprintEdge[]
      if (!nodes.length) {
        nodes = initialNodes
        edges = initialEdges
      }
      if (latest && !latest.note?.toLowerCase().includes("vertical")) {
        nodes = nodes.map((node, index) => {
          const x = node.position?.x ?? 80 + (index % 4) * 280
          const y = node.position?.y ?? 80 + Math.floor(index / 4) * 180
          return { ...node, position: { x: y, y: x } }
        })
      }
      versionNumber = latest ? latest.version + 1 : 2
    }

    if (nodes.some((node) => node.id === nodeId) || nodes.length >= 100) return

    const primary = nodes.find((node) => node.type === "service") ?? nodes[0]
    const anchor = primary?.position ?? { x: 80, y: 80 }
    const occupied = nodes.map((node, index) => ({
      x: node.position?.x ?? 80 + (index % 4) * 280,
      y: node.position?.y ?? 80 + Math.floor(index / 4) * 180,
    }))
    let position = { x: anchor.x, y: anchor.y + 150 }
    for (let index = 0; index < 400; index += 1) {
      const candidate = {
        x: anchor.x + Math.floor(index / 6) * 300,
        y: anchor.y + 150 + (index % 6) * 150,
      }
      if (
        occupied.every(
          (item) => Math.abs(item.x - candidate.x) >= 250 || Math.abs(item.y - candidate.y) >= 130,
        )
      ) {
        position = candidate
        break
      }
    }

    const featureNode: BlueprintNode = {
      id: nodeId,
      label: feature.title.slice(0, 100),
      type: "process",
      feature: feature.description.slice(0, 180),
      position,
    }
    const nextNodes = [...nodes, featureNode]
    const nextEdges = primary
      ? [
          ...edges,
          {
            id: `auto_${primary.id}_${nodeId}`.slice(0, 80),
            source: primary.id,
            target: nodeId,
            label: "feature request",
          },
        ]
      : edges

    if (!blueprint.versions.length) {
      await transaction.blueprintVersion.create({
        data: {
          blueprintId: blueprint.id,
          version: 1,
          nodes,
          edges,
          note: "Initial feedback architecture",
        },
      })
    }
    await transaction.blueprintVersion.create({
      data: {
        blueprintId: blueprint.id,
        version: versionNumber,
        nodes: nextNodes,
        edges: nextEdges,
        note: "Vertical architecture layout · public feature request added",
      },
    })
  })
}
