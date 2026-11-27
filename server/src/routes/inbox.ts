import { InboxStatus, Prisma } from "@prisma/client"
import { Router } from "express"
import { z } from "zod"
import { prisma } from "../db.js"
import { handleError, requireAuth, type AuthRequest } from "../middleware/auth.js"
import {
  redactRequesterDetails,
  triageInboxText,
  type InboxTriageSuggestion,
} from "../services/inboxTriage.js"

export const inboxRouter = Router({ mergeParams: true })
inboxRouter.use(requireAuth)

const sourceSchema = z.enum(["MANUAL", "PASTE", "CSV"])
const emailSchema = z.string().trim().toLowerCase().email().max(254)
const createItemSchema = z
  .object({
    rawText: z.string().trim().min(1).max(5000),
    source: sourceSchema.default("MANUAL"),
    requesterName: z.string().trim().max(120).optional(),
    requesterEmail: emailSchema.optional(),
    sourceNote: z.string().trim().max(200).optional(),
  })
  .strict()
const importSchema = z
  .object({ text: z.string().min(1).max(260_000), source: z.enum(["PASTE", "CSV"]) })
  .strict()
const listSchema = z.object({
  status: z.enum(["NEW", "LINKED", "CREATED", "DISCARDED", "DONE"]).optional(),
  cursor: z.string().min(1).optional(),
})
const emptyBodySchema = z.object({}).strict()
const resolveSchema = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("link"), postId: z.string().min(1) }).strict(),
    z
      .object({
        action: z.literal("create"),
        title: z.string().trim().min(5).max(120),
        body: z.string().trim().max(5000).optional(),
      })
      .strict(),
    z.object({ action: z.literal("discard") }).strict(),
  ])
  .and(z.object({ suggestionIndex: z.number().int().min(0).max(4).default(0) }).strict())

type SuggestionResolution = {
  action: "link" | "create" | "discard"
  postId?: string
  processedAt: string
}
type StoredSuggestion = InboxTriageSuggestion & { resolution?: SuggestionResolution }
type StoredSuggestionDocument = { requests: StoredSuggestion[] }

class InboxRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const getWorkspace = async (
  slug: string,
  userId: string,
  response: Parameters<typeof handleError>[1],
) => {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, ownerId: true, name: true },
  })
  const accessStatus = inboxWorkspaceAccessStatus(workspace, userId)
  if (accessStatus === 404) {
    response.status(accessStatus).json({ error: "Workspace not found" })
    return null
  }
  if (accessStatus === 403) {
    response.status(accessStatus).json({ error: "You do not have access to this workspace" })
    return null
  }
  return workspace
}

// This codebase has workspace ownership rather than Membership/role records.
export const inboxWorkspaceAccessStatus = (
  workspace: { ownerId: string } | null,
  userId: string,
) => (workspace ? (workspace.ownerId === userId ? null : 403) : 404)

const validationError = (response: Parameters<typeof handleError>[1], error: z.ZodError) =>
  response.status(400).json({ error: error.issues[0]?.message ?? "Invalid request" })

const parseCsv = (text: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"' && field.length === 0) quoted = true
    else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else field += char
  }
  if (quoted) throw new InboxRouteError("CSV contains an unclosed quoted field", 400)
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  const header = rows.shift()?.map((value) => value.trim().toLowerCase()) ?? []
  const textIndex = header.indexOf("text")
  if (textIndex === -1) throw new InboxRouteError("CSV must include a text column", 400)
  const nameIndex = header.indexOf("name")
  const emailIndex = header.indexOf("email")
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => ({
      rawText: values[textIndex]?.trim() ?? "",
      requesterName: nameIndex === -1 ? undefined : values[nameIndex]?.trim() || undefined,
      requesterEmail: emailIndex === -1 ? undefined : values[emailIndex]?.trim() || undefined,
    }))
}

const createImportedItems = (text: string, source: "PASTE" | "CSV") => {
  const items =
    source === "CSV"
      ? parseCsv(text)
      : text
          .split(/\n\s*\n/)
          .map((rawText) => ({ rawText: rawText.trim() }))
          .filter((entry) => entry.rawText.length > 0)
  if (!items.length) throw new InboxRouteError("Add at least one feedback item", 400)
  if (items.length > 50) throw new InboxRouteError("Import up to 50 feedback items at a time", 400)
  const validated = z
    .array(
      z.object({
        rawText: z.string().trim().min(1).max(5000),
        requesterName: z.string().trim().max(120).optional(),
        requesterEmail: emailSchema.optional(),
      }),
    )
    .safeParse(items)
  if (!validated.success)
    throw new InboxRouteError(validated.error.issues[0]?.message ?? "Invalid import", 400)
  return validated.data
}

type ResolveInput = z.infer<typeof resolveSchema>

export const resolveInboxSuggestion = async (
  transaction: Prisma.TransactionClient,
  args: {
    id: string
    workspaceId: string
    userId: string
    input: ResolveInput
  },
) => {
  const { id, workspaceId, userId, input } = args
  // Serialize concurrent resolves for this item. Every read and write stays tenant-scoped.
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "InboxItem"
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    FOR UPDATE
  `
  const item = await transaction.inboxItem.findFirst({ where: { id, workspaceId } })
  if (!item) throw new InboxRouteError("Inbox item not found", 404)
  if (item.status !== "NEW") throw new InboxRouteError("This inbox item is already processed", 409)
  const document = item.suggestion as unknown as StoredSuggestionDocument | null
  const requests = document?.requests
  const suggestion = requests?.[input.suggestionIndex]
  if (!requests || !suggestion)
    throw new InboxRouteError("Analyze this item before resolving it", 409)
  if (suggestion.resolution)
    throw new InboxRouteError("This suggestion has already been resolved", 409)

  let resultPostId: string | undefined
  if (input.action === "link" || input.action === "create") {
    if (input.action === "link") {
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Post"
        WHERE "id" = ${input.postId} AND "workspaceId" = ${workspaceId}
        FOR UPDATE
      `
    }
    const post =
      input.action === "link"
        ? await transaction.post.findFirst({
            where: {
              id: input.postId,
              workspaceId,
              mergedIntoId: null,
              status: { in: ["OPEN", "PLANNED", "IN_PROGRESS"] },
            },
            select: { id: true },
          })
        : await transaction.post.create({
            data: {
              title: input.title,
              description: input.body?.trim() || suggestion.summary,
              status: "OPEN",
              authorId: userId,
              workspaceId,
            },
            select: { id: true },
          })
    if (!post) throw new InboxRouteError("Choose a post in this workspace", 400)
    resultPostId = post.id

    const email = item.requesterEmail?.trim().toLowerCase()
    const requester = email
      ? await transaction.requester.upsert({
          where: { workspaceId_email: { workspaceId, email } },
          update: item.requesterName ? { name: item.requesterName } : {},
          create: { workspaceId, email, name: item.requesterName },
          select: { id: true },
        })
      : await transaction.requester.create({
          data: { workspaceId, name: item.requesterName },
          select: { id: true },
        })
    const attached = await transaction.postRequester.createMany({
      data: [{ postId: post.id, requesterId: requester.id }],
      skipDuplicates: true,
    })
    if (attached.count > 0) {
      await transaction.post.update({
        where: { id: post.id },
        data: { voteCount: { increment: 1 } },
      })
    }
  }

  const processedAt = new Date().toISOString()
  const updatedRequests = requests.map((entry, index) =>
    index === input.suggestionIndex
      ? {
          ...entry,
          resolution: {
            action: input.action,
            ...(resultPostId ? { postId: resultPostId } : {}),
            processedAt,
          } satisfies SuggestionResolution,
        }
      : entry,
  )
  const allResolved = updatedRequests.every((entry) => Boolean(entry.resolution))
  const nextStatus: InboxStatus = allResolved
    ? updatedRequests.some((entry) => entry.resolution?.action === "create")
      ? "CREATED"
      : updatedRequests.some((entry) => entry.resolution?.action === "link")
        ? "LINKED"
        : "DISCARDED"
    : "NEW"
  const updated = await transaction.inboxItem.update({
    where: { id: item.id },
    data: {
      suggestion: { requests: updatedRequests } as Prisma.InputJsonValue,
      status: nextStatus,
      resultPostId: resultPostId ?? item.resultPostId,
      processedAt: allResolved ? new Date(processedAt) : null,
    },
  })
  return updated
}

const analyzeLimits = new Map<string, { day: string; count: number }>()
const allowAnalysis = (workspaceId: string, now = new Date()) => {
  const day = now.toISOString().slice(0, 10)
  const current = analyzeLimits.get(workspaceId)
  if (!current || current.day !== day) {
    analyzeLimits.set(workspaceId, { day, count: 1 })
    return true
  }
  if (current.count >= 30) return false
  current.count += 1
  return true
}

inboxRouter.get("/count", async (request: AuthRequest, response) => {
  try {
    const workspace = await getWorkspace(String(request.params.slug), request.userId!, response)
    if (!workspace) return
    const newCount = await prisma.inboxItem.count({
      where: { workspaceId: workspace.id, status: "NEW" },
    })
    response.json({ newCount })
  } catch (error) {
    handleError(error, response)
  }
})

inboxRouter.get("/posts", async (request: AuthRequest, response) => {
  try {
    const workspace = await getWorkspace(String(request.params.slug), request.userId!, response)
    if (!workspace) return
    const posts = await prisma.post.findMany({
      where: {
        workspaceId: workspace.id,
        mergedIntoId: null,
        status: { in: ["OPEN", "PLANNED", "IN_PROGRESS"] },
      },
      orderBy: { voteCount: "desc" },
      take: 100,
      select: { id: true, title: true, status: true, voteCount: true },
    })
    response.json(posts.map((post) => ({ ...post, votes: post.voteCount })))
  } catch (error) {
    handleError(error, response)
  }
})

inboxRouter.post("/import", async (request: AuthRequest, response) => {
  try {
    const workspace = await getWorkspace(String(request.params.slug), request.userId!, response)
    if (!workspace) return
    const parsed = importSchema.safeParse(request.body)
    if (!parsed.success) return validationError(response, parsed.error)
    const items = createImportedItems(parsed.data.text, parsed.data.source)
    const created = await prisma.inboxItem.createManyAndReturn({
      data: items.map((item) => ({
        workspaceId: workspace.id,
        source: parsed.data.source,
        rawText: item.rawText,
        ...(item.requesterName ? { requesterName: item.requesterName } : {}),
        ...(item.requesterEmail ? { requesterEmail: item.requesterEmail.toLowerCase() } : {}),
        createdById: request.userId!,
      })),
      select: {
        id: true,
        source: true,
        rawText: true,
        requesterName: true,
        requesterEmail: true,
        sourceNote: true,
        status: true,
        suggestion: true,
        resultPostId: true,
        createdAt: true,
        processedAt: true,
      },
    })
    response.status(201).json({ items: created })
  } catch (error) {
    if (error instanceof InboxRouteError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    handleError(error, response)
  }
})

inboxRouter.post("/", async (request: AuthRequest, response) => {
  try {
    const workspace = await getWorkspace(String(request.params.slug), request.userId!, response)
    if (!workspace) return
    const parsed = createItemSchema.safeParse(request.body)
    if (!parsed.success) return validationError(response, parsed.error)
    const item = await prisma.inboxItem.create({
      data: {
        workspaceId: workspace.id,
        createdById: request.userId!,
        rawText: parsed.data.rawText,
        source: parsed.data.source,
        ...(parsed.data.requesterName !== undefined
          ? { requesterName: parsed.data.requesterName }
          : {}),
        ...(parsed.data.requesterEmail !== undefined
          ? { requesterEmail: parsed.data.requesterEmail }
          : {}),
        ...(parsed.data.sourceNote !== undefined ? { sourceNote: parsed.data.sourceNote } : {}),
      },
      select: {
        id: true,
        source: true,
        rawText: true,
        requesterName: true,
        requesterEmail: true,
        sourceNote: true,
        status: true,
        suggestion: true,
        resultPostId: true,
        createdAt: true,
        processedAt: true,
      },
    })
    response.status(201).json(item)
  } catch (error) {
    handleError(error, response)
  }
})

inboxRouter.get("/", async (request: AuthRequest, response) => {
  try {
    const workspace = await getWorkspace(String(request.params.slug), request.userId!, response)
    if (!workspace) return
    const parsed = listSchema.safeParse(request.query)
    if (!parsed.success) return validationError(response, parsed.error)
    const statusFilter = parsed.data.status
    const where: Prisma.InboxItemWhereInput = {
      workspaceId: workspace.id,
      ...(statusFilter === "DONE"
        ? { status: { in: ["LINKED", "CREATED", "DISCARDED"] } }
        : statusFilter
          ? { status: statusFilter }
          : {}),
    }
    if (parsed.data.cursor) {
      const cursor = await prisma.inboxItem.findFirst({
        where: { ...where, id: parsed.data.cursor },
        select: { id: true },
      })
      if (!cursor) {
        response
          .status(400)
          .json({ error: "Inbox cursor is invalid for this workspace and filter" })
        return
      }
    }
    const page = await prisma.inboxItem.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        source: true,
        rawText: true,
        requesterName: true,
        requesterEmail: true,
        sourceNote: true,
        status: true,
        suggestion: true,
        resultPostId: true,
        createdAt: true,
        processedAt: true,
      },
    })
    const hasMore = page.length > 20
    const items = hasMore ? page.slice(0, 20) : page
    const newCount = await prisma.inboxItem.count({
      where: { workspaceId: workspace.id, status: "NEW" },
    })
    response.json({ items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null, newCount })
  } catch (error) {
    handleError(error, response)
  }
})

inboxRouter.post("/:id/analyze", async (request: AuthRequest, response) => {
  try {
    const workspace = await getWorkspace(String(request.params.slug), request.userId!, response)
    if (!workspace) return
    const body = emptyBodySchema.safeParse(request.body ?? {})
    if (!body.success) return validationError(response, body.error)
    const item = await prisma.inboxItem.findFirst({
      where: { id: String(request.params.id), workspaceId: workspace.id },
      select: {
        id: true,
        rawText: true,
        requesterName: true,
        requesterEmail: true,
        status: true,
        suggestion: true,
      },
    })
    if (!item) {
      response.status(404).json({ error: "Inbox item not found" })
      return
    }
    if (item.status !== "NEW") {
      response.status(409).json({ error: "This inbox item is already processed" })
      return
    }
    if (!allowAnalysis(workspace.id)) {
      response.status(429).json({ error: "Daily AI triage limit reached for this workspace" })
      return
    }
    const prior = item.suggestion as unknown as StoredSuggestionDocument | null
    if (prior?.requests?.some((entry) => entry.resolution)) {
      response
        .status(409)
        .json({ error: "Finish resolving the current suggestions before analyzing again" })
      return
    }
    const posts = await prisma.post.findMany({
      where: {
        workspaceId: workspace.id,
        mergedIntoId: null,
        status: { in: ["OPEN", "PLANNED", "IN_PROGRESS"] },
      },
      orderBy: { voteCount: "desc" },
      take: 100,
      select: { id: true, title: true },
    })
    const suggestion = await triageInboxText(
      redactRequesterDetails(item.rawText, item.requesterName, item.requesterEmail),
      posts,
      { workspaceId: workspace.id },
    )
    const updated = await prisma.inboxItem.updateMany({
      where: { id: item.id, workspaceId: workspace.id, status: "NEW" },
      data: { suggestion },
    })
    if (!updated.count) {
      response.status(409).json({ error: "This inbox item is already processed" })
      return
    }
    response.json({ id: item.id, suggestion })
  } catch (error) {
    if (error instanceof InboxRouteError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    const status = (error as { statusCode?: unknown })?.statusCode
    if (status === 502 || status === 503) {
      response.status(status).json({ error: (error as Error).message })
      return
    }
    handleError(error, response)
  }
})

inboxRouter.post("/:id/resolve", async (request: AuthRequest, response) => {
  try {
    const workspace = await getWorkspace(String(request.params.slug), request.userId!, response)
    if (!workspace) return
    const parsed = resolveSchema.safeParse(request.body)
    if (!parsed.success) return validationError(response, parsed.error)
    const result = await prisma.$transaction((transaction) =>
      resolveInboxSuggestion(transaction, {
        id: String(request.params.id),
        workspaceId: workspace.id,
        userId: request.userId!,
        input: parsed.data,
      }),
    )
    response.json(result)
  } catch (error) {
    if (error instanceof InboxRouteError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    handleError(error, response)
  }
})
