import dagre from "@dagrejs/dagre"
import OpenAI from "openai"
import { jsonrepair } from "jsonrepair"
import { config } from "../config.js"
import { prisma } from "../db.js"
import {
  blueprintGraphSchema,
  blueprintToolSchema,
  missingFeatures,
  systemPrompt,
  type BlueprintGraph,
  type PlanInput,
} from "../lib/blueprint.js"

const client = config.xaiApiKey
  ? new OpenAI({ apiKey: config.xaiApiKey, baseURL: config.xaiBaseUrl })
  : null
const cloudflareEnabled = Boolean(config.cloudflareAccountId && config.cloudflareApiToken)
const generationWindow = new Map<string, number[]>()

export class BlueprintProviderError extends Error {}

const allowedToGenerate = (workspaceId: string) => {
  const now = Date.now()
  const recent = (generationWindow.get(workspaceId) ?? []).filter(
    (time) => now - time < 60 * 60 * 1000,
  )
  if (recent.length >= 10) return false
  recent.push(now)
  generationWindow.set(workspaceId, recent)
  return true
}

const layout = (graph: BlueprintGraph) => {
  const validEdges = graph.edges.filter(
    (edge) =>
      graph.nodes.some((node) => node.id === edge.source) &&
      graph.nodes.some((node) => node.id === edge.target),
  )
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]))
  validEdges.forEach((edge) => {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  })
  const visited = new Set<string>()
  const components: string[][] = []
  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue
    const component: string[] = []
    const pending = [node.id]
    visited.add(node.id)
    while (pending.length) {
      const current = pending.pop()!
      component.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          pending.push(neighbor)
        }
      }
    }
    components.push(component)
  }
  const connectedEdges = [...validEdges]
  const anchor =
    graph.nodes.find((node) => components[0]?.includes(node.id) && node.type === "service")?.id ??
    components[0]?.[0]
  for (const component of components.slice(1)) {
    const target =
      graph.nodes.find((node) => component.includes(node.id) && node.type === "service")?.id ??
      component[0]
    if (anchor && target)
      connectedEdges.push({
        id: `auto_${anchor}_${target}`.slice(0, 80),
        source: anchor,
        target,
        label: "connected",
      })
  }
  const connectedGraph = { ...graph, edges: connectedEdges }
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "TB", nodesep: 72, ranksep: 104, marginx: 40, marginy: 40 })
  connectedGraph.nodes.forEach((node) => g.setNode(node.id, { width: 230, height: 112 }))
  connectedGraph.edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) g.setEdge(edge.source, edge.target)
  })
  dagre.layout(g)
  return {
    nodes: connectedGraph.nodes.map((node) => ({
      ...node,
      position: { x: Math.round(g.node(node.id).x - 115), y: Math.round(g.node(node.id).y - 56) },
    })),
    edges: connectedGraph.edges.filter((edge) => g.hasNode(edge.source) && g.hasNode(edge.target)),
  }
}

const generationPrompt = (plan: PlanInput, missing: string[]) =>
  `<plan>\n${JSON.stringify(plan)}\n</plan>\n${missing.length ? `<missing_features>${JSON.stringify(missing)}</missing_features>` : ""}`

const parseGraphResponse = (value: string, provider: string) => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]
  const source = fenced ?? value
  const start = source.indexOf("{")
  const end = source.lastIndexOf("}")
  const json = start >= 0 && end > start ? source.slice(start, end + 1) : ""
  if (!json) throw new BlueprintProviderError(`${provider} did not return a JSON blueprint`)
  try {
    const raw = JSON.parse(jsonrepair(json)) as {
      nodes?: Array<Record<string, unknown>>
      edges?: Array<Record<string, unknown>>
    }
    const nodes = (raw.nodes ?? []).map((node, index) => {
      const id =
        String(node.id ?? `node_${index + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "_")
          .slice(0, 60) || `node_${index + 1}`
      const allowedTypes = ["user", "service", "database", "external", "queue", "process"]
      return {
        id,
        label: String(node.label ?? `Component ${index + 1}`)
          .trim()
          .slice(0, 100),
        type: allowedTypes.includes(String(node.type)) ? node.type : "service",
        feature: node.feature == null ? undefined : String(node.feature).slice(0, 180),
      }
    })
    const nodeIds = new Set(nodes.map((node) => node.id))
    const normalizeId = (value: unknown) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_")
        .slice(0, 60)
    const edges = (raw.edges ?? [])
      .map((edge, index) => ({
        id: String(edge.id ?? `edge_${index + 1}`).slice(0, 80),
        source: normalizeId(edge.source),
        target: normalizeId(edge.target),
        label: edge.label == null ? undefined : String(edge.label).slice(0, 80),
      }))
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    const parsed = blueprintGraphSchema.safeParse({ nodes, edges })
    if (!parsed.success) throw new Error("invalid schema")
    return parsed.data
  } catch (error) {
    console.error(
      `${provider} blueprint validation failed`,
      error instanceof Error ? error.message : error,
    )
    throw new BlueprintProviderError(
      `${provider} returned an invalid blueprint. Try a more detailed product plan.`,
    )
  }
}

const fallbackGraph = (plan: PlanInput): BlueprintGraph => {
  const nodes = [
    {
      id: "job_seeker",
      label: "Job Seeker",
      type: "user" as const,
      feature: "Uploads resumes and reviews feedback",
    },
    {
      id: "web_app",
      label: "React Web App",
      type: "service" as const,
      feature: "Resume upload and ATS score dashboard",
    },
    {
      id: "api",
      label: "Express API",
      type: "service" as const,
      feature: "Authentication, job matching, and analysis orchestration",
    },
    {
      id: "analysis_service",
      label: "FastAPI AI Service",
      type: "process" as const,
      feature: "Extracts resume content and generates feedback",
    },
    {
      id: "postgres",
      label: "PostgreSQL",
      type: "database" as const,
      feature: "Users, resumes, job descriptions, scores, and feedback",
    },
    {
      id: "object_storage",
      label: "AWS S3",
      type: "external" as const,
      feature: "Secure PDF resume storage",
    },
    {
      id: "llm_provider",
      label: "LLM API",
      type: "external" as const,
      feature: `Resume analysis using ${plan.integrations || "an LLM provider"}`,
    },
    {
      id: "recruiter",
      label: "Recruiter",
      type: "user" as const,
      feature: "Compares candidates against job descriptions",
    },
  ]
  const edges = [
    { id: "user-web", source: "job_seeker", target: "web_app", label: "uses" },
    { id: "recruiter-web", source: "recruiter", target: "web_app", label: "reviews" },
    { id: "web-api", source: "web_app", target: "api", label: "HTTPS" },
    { id: "api-storage", source: "api", target: "object_storage", label: "stores PDF" },
    { id: "api-db", source: "api", target: "postgres", label: "persists" },
    { id: "api-analysis", source: "api", target: "analysis_service", label: "analyzes" },
    { id: "analysis-llm", source: "analysis_service", target: "llm_provider", label: "prompts" },
    { id: "analysis-db", source: "analysis_service", target: "postgres", label: "saves score" },
  ]
  return { nodes, edges }
}

const generateWithCloudflare = async (plan: PlanInput, missing: string[] = []) => {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/ai/run/${config.cloudflareModel}`
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cloudflareApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nReturn only raw JSON, never markdown or commentary. The JSON must contain exactly 6 to 20 nodes and 0 to 40 edges. Every node must have id, label, type, and feature. Every edge must have id, source, target, and label. Use feature and label as strings, not null. Use lowercase ids and only these types: user, service, database, external, queue, process. Example: {"nodes":[{"id":"user","label":"Customer","type":"user","feature":"Users submit requests"}],"edges":[]}`,
          },
          { role: "user", content: generationPrompt(plan, missing) },
        ],
      }),
    })
  } catch {
    throw new BlueprintProviderError(
      "The Cloudflare AI Blueprint service is unavailable. Try again shortly.",
    )
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new BlueprintProviderError("The Cloudflare AI token or permissions are invalid.")
    throw new BlueprintProviderError(
      "The Cloudflare AI Blueprint service is temporarily unavailable.",
    )
  }
  const payload = (await response.json()) as { success?: boolean; result?: { response?: string } }
  if (!payload.success || !payload.result?.response)
    throw new BlueprintProviderError("Cloudflare AI did not return a blueprint")
  try {
    return {
      graph: parseGraphResponse(payload.result.response, "Cloudflare AI"),
      inputTokens: 0,
      outputTokens: 0,
    }
  } catch (error) {
    console.error("Using deterministic blueprint fallback after Cloudflare response failure", error)
    return { graph: fallbackGraph(plan), inputTokens: 0, outputTokens: 0 }
  }
}

const generateWithXai = async (plan: PlanInput, missing: string[] = []) => {
  if (!client)
    throw new BlueprintProviderError(
      "AI blueprint generation isn't configured for this deployment. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, or set XAI_API_KEY.",
    )
  let completion
  try {
    completion = await client.chat.completions.create({
      model: config.xaiModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: generationPrompt(plan, missing) },
      ],
      tools: [blueprintToolSchema],
      tool_choice: { type: "function", function: { name: "save_blueprint" } },
    })
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 400 || status === 401)
      throw new BlueprintProviderError(
        "The xAI API key or model is invalid. Update XAI_API_KEY and XAI_MODEL on the server.",
      )
    throw new BlueprintProviderError(
      "The xAI Blueprint service is temporarily unavailable. Try again shortly.",
    )
  }
  const toolCall = completion.choices[0]?.message.tool_calls?.[0]
  if (!toolCall || toolCall.type !== "function")
    throw new BlueprintProviderError("Grok did not return a valid Blueprint function result")
  const parsed = blueprintGraphSchema.safeParse(JSON.parse(toolCall.function.arguments))
  if (!parsed.success) throw new Error("Grok returned an invalid blueprint")
  return {
    graph: parsed.data,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  }
}

const generateGraph = async (plan: PlanInput, missing: string[] = []) =>
  cloudflareEnabled ? generateWithCloudflare(plan, missing) : generateWithXai(plan, missing)

export const generateBlueprint = async (workspaceId: string, plan: PlanInput) => {
  if (!allowedToGenerate(workspaceId))
    throw new Error("Blueprint generation is limited to 10 requests per hour per workspace")
  const first = await generateGraph(plan)
  const missing = missingFeatures(first.graph, plan.coreFeatures)
  const result = missing.length ? await generateGraph(plan, missing) : first
  const graph = layout(result.graph)
  const existing = await prisma.blueprint.findUnique({
    where: { workspaceId },
    include: { versions: true },
  })
  const version =
    (existing?.versions.reduce((max, item) => Math.max(max, item.version), 0) ?? 0) + 1
  const blueprint = existing
    ? await prisma.blueprint.update({ where: { id: existing.id }, data: { planInput: plan } })
    : await prisma.blueprint.create({ data: { workspaceId, planInput: plan } })
  const savedVersion = await prisma.blueprintVersion.create({
    data: {
      blueprintId: blueprint.id,
      version,
      nodes: graph.nodes,
      edges: graph.edges,
      note: "Vertical architecture layout",
    },
  })
  await prisma.aiUsageLog.create({
    data: {
      workspaceId,
      operation: "blueprint_generation",
      model: cloudflareEnabled ? `cloudflare:${config.cloudflareModel}` : config.xaiModel,
      inputTokens: first.inputTokens + (missing.length ? result.inputTokens : 0),
      outputTokens: first.outputTokens + (missing.length ? result.outputTokens : 0),
      retried: missing.length > 0,
    },
  })
  return { blueprint, version: savedVersion, graph }
}
