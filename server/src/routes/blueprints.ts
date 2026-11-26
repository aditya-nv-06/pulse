import { Router } from "express"
import { prisma } from "../db.js"
import { handleError, requireAuth, type AuthRequest } from "../middleware/auth.js"
import { editableBlueprintGraphSchema, planInputSchema } from "../lib/blueprint.js"
import { BlueprintProviderError, generateBlueprint } from "../services/blueprint.js"

export const blueprintRouter = Router()
blueprintRouter.use(requireAuth)

const ownedWorkspace = (request: AuthRequest) =>
  prisma.workspace.findFirst({
    where: { slug: String(request.params.slug), ownerId: request.userId! },
  })

blueprintRouter.get("/:slug/blueprint", async (request: AuthRequest, response) => {
  try {
    const workspace = await ownedWorkspace(request)
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const blueprint = await prisma.blueprint.findUnique({
      where: { workspaceId: workspace.id },
      include: { versions: { orderBy: { version: "desc" }, take: 20 } },
    })
    if (!blueprint) {
      response.json(null)
      return
    }
    const version = blueprint.versions[0]
    response.json({
      blueprint: { id: blueprint.id, planInput: blueprint.planInput },
      version,
      graph: { nodes: version?.nodes ?? [], edges: version?.edges ?? [] },
    })
  } catch (error) {
    handleError(error, response)
  }
})

blueprintRouter.put("/:slug/blueprint", async (request: AuthRequest, response) => {
  try {
    const workspace = await ownedWorkspace(request)
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const parsed = editableBlueprintGraphSchema.safeParse(request.body)
    if (!parsed.success) {
      response
        .status(400)
        .json({ error: "The blueprint graph is invalid", details: parsed.error.flatten() })
      return
    }
    const blueprint = await prisma.blueprint.findUnique({
      where: { workspaceId: workspace.id },
      include: { versions: true },
    })
    if (!blueprint) {
      response.status(404).json({ error: "Generate a blueprint before editing it" })
      return
    }
    const version =
      (blueprint.versions.reduce((max, item) => Math.max(max, item.version), 0) ?? 0) + 1
    const savedVersion = await prisma.blueprintVersion.create({
      data: {
        blueprintId: blueprint.id,
        version,
        nodes: parsed.data.nodes,
        edges: parsed.data.edges,
        note: "Manual canvas edit · vertical layout",
      },
    })
    response.status(201).json({ version: savedVersion, graph: parsed.data })
  } catch (error) {
    handleError(error, response)
  }
})

blueprintRouter.post("/:slug/blueprint/generate", async (request: AuthRequest, response) => {
  try {
    const workspace = await ownedWorkspace(request)
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const parsed = planInputSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({
        error: "Complete the plan fields with valid values",
        details: parsed.error.flatten(),
      })
      return
    }
    const result = await generateBlueprint(workspace.id, parsed.data)
    response.status(201).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate blueprint"
    const status =
      error instanceof BlueprintProviderError ? 503 : message.includes("limited") ? 429 : 500
    response.status(status).json({ error: message })
  }
})
