import { Router } from "express"
import { PostStatus } from "@prisma/client"
import { z } from "zod"
import { prisma } from "../db.js"
import { handleError, requireAuth, type AuthRequest } from "../middleware/auth.js"
import { isPostStatus, postInclude, serializeAdminPost } from "../lib/posts.js"
import { isGoogleAppsScriptWebhook } from "../services/google-sheets.js"

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const googleSheetsSettingsSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: z.string().trim().max(2048).optional(),
})
const meetingRequestsEnabledSchema = z.object({ enabled: z.boolean() })
const meetingRequestUpdateSchema = z
  .object({
    status: z.enum(["REQUESTED", "COMPLETED", "REJECTED"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((input) => input.status !== "REJECTED" || Boolean(input.note && input.note.length >= 3), {
    message: "Add a reason before rejecting this request.",
  })
export const workspaceRouter = Router()
workspaceRouter.use(requireAuth)

const ensurePrimaryWorkspace = async (userId: string) => {
  const existing = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  })
  if (existing) return existing
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  if (!user) return null
  return prisma.workspace.create({
    data: {
      name: `${user.name ?? "My"} workspace`,
      slug: `workspace-${userId.slice(-8)}`,
      ownerId: userId,
    },
  })
}

workspaceRouter.get("/me", async (request: AuthRequest, response) => {
  try {
    response.json(await ensurePrimaryWorkspace(request.userId!))
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.get("/", async (request: AuthRequest, response) => {
  try {
    await ensurePrimaryWorkspace(request.userId!)
    response.json(
      await prisma.workspace.findMany({
        where: { ownerId: request.userId! },
        orderBy: { createdAt: "asc" },
      }),
    )
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.get("/:slug/analytics", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
      select: { id: true },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const requestedDays = Number(request.query.days ?? 30)
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const currentStart = new Date(today.getTime() - (days - 1) * 86_400_000)
    const previousStart = new Date(currentStart.getTime() - days * 86_400_000)
    const buckets = Array.from({ length: days }, (_, index) => {
      const date = new Date(currentStart.getTime() + index * 86_400_000)
      return { date: date.toISOString().slice(0, 10), requests: 0, votes: 0, meetingRequests: 0 }
    })
    const bucketByDate = new Map(buckets.map((bucket) => [bucket.date, bucket]))
    const [
      statusGroups,
      requestEvents,
      voteEvents,
      meetingRequestEvents,
      allPosts,
      topPosts,
      allVotes,
      shippedFeatures,
    ] = await Promise.all([
      prisma.post.groupBy({
        by: ["status"],
        where: { workspaceId: workspace.id, mergedIntoId: null },
        _count: { _all: true },
      }),
      prisma.post.findMany({
        where: {
          workspaceId: workspace.id,
          mergedIntoId: null,
          createdAt: { gte: previousStart, lt: new Date(today.getTime() + 86_400_000) },
        },
        select: { createdAt: true },
      }),
      prisma.vote.findMany({
        where: {
          post: { workspaceId: workspace.id },
          createdAt: { gte: previousStart, lt: new Date(today.getTime() + 86_400_000) },
        },
        select: { createdAt: true },
      }),
      prisma.post.findMany({
        where: {
          workspaceId: workspace.id,
          meetingRequested: true,
          mergedIntoId: null,
          createdAt: { gte: previousStart, lt: new Date(today.getTime() + 86_400_000) },
        },
        select: { createdAt: true },
      }),
      prisma.post.findMany({
        where: { workspaceId: workspace.id, mergedIntoId: null },
        select: { teamReply: true },
      }),
      prisma.post.findMany({
        where: { workspaceId: workspace.id, mergedIntoId: null },
        orderBy: { votes: { _count: "desc" } },
        take: 5,
        select: { id: true, title: true, status: true, _count: { select: { votes: true } } },
      }),
      prisma.vote.count({ where: { post: { workspaceId: workspace.id } } }),
      prisma.post.findMany({
        where: { workspaceId: workspace.id, status: "SHIPPED", mergedIntoId: null },
        orderBy: [{ shippedAt: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          description: true,
          shippedAt: true,
          updatedAt: true,
          _count: { select: { votes: true } },
        },
      }),
    ])
    const countRange = (items: { createdAt: Date }[], from: Date, to: Date) =>
      items.filter((item) => item.createdAt >= from && item.createdAt < to).length
    for (const item of requestEvents) {
      const bucket = bucketByDate.get(item.createdAt.toISOString().slice(0, 10))
      if (bucket) bucket.requests += 1
    }
    for (const item of voteEvents) {
      const bucket = bucketByDate.get(item.createdAt.toISOString().slice(0, 10))
      if (bucket) bucket.votes += 1
    }
    for (const item of meetingRequestEvents) {
      const bucket = bucketByDate.get(item.createdAt.toISOString().slice(0, 10))
      if (bucket) bucket.meetingRequests += 1
    }
    const statuses = Object.fromEntries(
      ["OPEN", "PLANNED", "IN_PROGRESS", "SHIPPED"].map((status) => [
        status,
        statusGroups.find((group) => group.status === status)?._count._all ?? 0,
      ]),
    )
    response.json({
      days,
      summary: {
        totalRequests: allPosts.length,
        totalVotes: allVotes,
        replyRate: allPosts.length
          ? Math.round(
              (allPosts.filter((post) => post.teamReply?.trim()).length / allPosts.length) * 100,
            )
          : 0,
        statuses,
      },
      current: {
        requests: countRange(requestEvents, currentStart, new Date(today.getTime() + 86_400_000)),
        votes: countRange(voteEvents, currentStart, new Date(today.getTime() + 86_400_000)),
        meetingRequests: countRange(
          meetingRequestEvents,
          currentStart,
          new Date(today.getTime() + 86_400_000),
        ),
      },
      previous: {
        requests: countRange(requestEvents, previousStart, currentStart),
        votes: countRange(voteEvents, previousStart, currentStart),
        meetingRequests: countRange(meetingRequestEvents, previousStart, currentStart),
      },
      trends: buckets,
      topFeatures: topPosts.map((post) => ({
        id: post.id,
        title: post.title,
        status: post.status,
        votes: post._count.votes,
      })),
      shippedFeatures: shippedFeatures.map((post) => ({
        id: post.id,
        title: post.title,
        description: post.description,
        shippedAt: post.shippedAt ?? post.updatedAt,
        votes: post._count.votes,
      })),
    })
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.post("/", async (request: AuthRequest, response) => {
  try {
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80),
        slug: z.string().trim().toLowerCase().min(1).max(50).regex(slugPattern),
      })
      .safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({
        code: "INVALID_WORKSPACE_DETAILS",
        error:
          "Enter a workspace name (up to 80 characters) and a URL slug using lowercase letters, numbers, and hyphens.",
      })
      return
    }
    const { name, slug } = parsed.data
    const user = await prisma.user.findUnique({
      where: { id: request.userId! },
      select: { workspaceLimit: true, subscriptionExpiresAt: true },
    })
    const workspaceCount = await prisma.workspace.count({ where: { ownerId: request.userId! } })
    const subscriptionActive =
      user?.subscriptionExpiresAt && user.subscriptionExpiresAt > new Date()
    const workspaceLimit = subscriptionActive ? user.workspaceLimit : 1
    if (!user || workspaceCount >= workspaceLimit) {
      response.status(402).json({
        code: "UPGRADE_REQUIRED",
        error: "Your free plan includes one workspace. Upgrade to create another.",
      })
      return
    }
    try {
      response
        .status(201)
        .json(await prisma.workspace.create({ data: { name, slug, ownerId: request.userId! } }))
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        response.status(409).json({
          code: "WORKSPACE_SLUG_TAKEN",
          error: "That public URL is already in use. Choose a different workspace slug.",
        })
        return
      }
      throw error
    }
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.get("/:slug/posts/:postId", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const post = await prisma.post.findFirst({
      where: { id: String(request.params.postId), workspaceId: workspace.id },
      include: postInclude,
    })
    if (!post) {
      response.status(404).json({ error: "Post not found" })
      return
    }
    response.json(serializeAdminPost(post))
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.get("/:slug/posts", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const posts = await prisma.post.findMany({
      where: { workspaceId: workspace.id },
      include: postInclude,
      orderBy: { updatedAt: "desc" },
    })
    response.json(posts.map(serializeAdminPost))
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.patch("/:slug/posts/:postId", async (request: AuthRequest, response) => {
  try {
    const status = request.body.status as PostStatus
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    if (!workspace || !isPostStatus(status)) {
      response.status(400).json({ error: "Workspace or status is invalid" })
      return
    }
    const post = await prisma.post.update({
      where: { id: String(request.params.postId) },
      data: { status, shippedAt: status === "SHIPPED" ? new Date() : null },
      include: postInclude,
    })
    response.json(serializeAdminPost(post))
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.post("/:slug/posts/:postId/reply", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    const reply = String(request.body.reply ?? "").trim()
    if (!workspace || !reply) {
      response.status(400).json({ error: "Workspace and reply are required" })
      return
    }
    const post = await prisma.post.update({
      where: { id: String(request.params.postId) },
      data: { teamReply: reply },
      include: postInclude,
    })
    response.json(serializeAdminPost(post))
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.post("/:slug/posts/:postId/merge", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    const targetId = String(request.body.targetId ?? "")
    const target =
      workspace &&
      (await prisma.post.findFirst({
        where: { id: targetId, workspaceId: workspace.id, mergedIntoId: null },
      }))
    if (!workspace || !target || target.id === String(request.params.postId)) {
      response.status(400).json({ error: "Choose another post in this workspace" })
      return
    }
    await prisma.post.update({
      where: { id: String(request.params.postId) },
      data: { mergedIntoId: target.id },
    })
    response.json({ merged: true, targetId: target.id })
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.post("/:slug/changelog", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    const title = String(request.body.title ?? "").trim()
    const body = String(request.body.body ?? "").trim()
    const postIds = Array.isArray(request.body.postIds) ? (request.body.postIds as string[]) : []
    if (!workspace || !title || !body) {
      response.status(400).json({ error: "Workspace, title, and body are required" })
      return
    }
    const entry = await prisma.changelogEntry.create({
      data: {
        title,
        body,
        workspaceId: workspace.id,
        posts: { create: postIds.map((postId) => ({ postId })) },
      },
      include: { posts: true },
    })
    response.status(201).json(entry)
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.get("/:slug/integrations/google-sheets", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
      select: { googleSheetsEnabled: true, googleSheetsWebhookUrl: true },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    response.json({
      enabled: workspace.googleSheetsEnabled,
      webhookUrl: workspace.googleSheetsWebhookUrl ?? "",
    })
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.put("/:slug/integrations/google-sheets", async (request: AuthRequest, response) => {
  try {
    const parsed = googleSheetsSettingsSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid Google Sheets settings" })
      return
    }
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const webhookUrl = parsed.data.webhookUrl?.trim() ?? workspace.googleSheetsWebhookUrl ?? ""
    if (webhookUrl && !isGoogleAppsScriptWebhook(webhookUrl)) {
      response.status(400).json({ error: "Use a deployed Google Apps Script URL ending in /exec" })
      return
    }
    if (parsed.data.enabled && !webhookUrl) {
      response
        .status(400)
        .json({ error: "Add your Google Apps Script webhook URL before enabling the integration" })
      return
    }
    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        googleSheetsEnabled: parsed.data.enabled,
        googleSheetsWebhookUrl: webhookUrl || null,
      },
      select: { googleSheetsEnabled: true, googleSheetsWebhookUrl: true },
    })
    response.json({
      enabled: updated.googleSheetsEnabled,
      webhookUrl: updated.googleSheetsWebhookUrl ?? "",
    })
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.get("/:slug/meeting-requests/settings", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
      select: { meetingEnabled: true },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    response.json({ enabled: workspace.meetingEnabled })
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.put("/:slug/meeting-requests/settings", async (request: AuthRequest, response) => {
  try {
    const parsed = meetingRequestsEnabledSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid meeting request setting" })
      return
    }
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { meetingEnabled: parsed.data.enabled },
      select: { meetingEnabled: true },
    })
    response.json({ enabled: updated.meetingEnabled })
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.get("/:slug/meeting-requests", async (request: AuthRequest, response) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const requests = await prisma.post.findMany({
      where: { workspaceId: workspace.id, meetingRequested: true, mergedIntoId: null },
      include: postInclude,
      orderBy: { createdAt: "desc" },
    })
    response.json(requests.map(serializeAdminPost))
  } catch (error) {
    handleError(error, response)
  }
})

workspaceRouter.patch("/:slug/meeting-requests/:postId", async (request: AuthRequest, response) => {
  try {
    const parsed = meetingRequestUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: "Choose a valid meeting request status." })
      return
    }
    const workspace = await prisma.workspace.findFirst({
      where: { slug: String(request.params.slug), ownerId: request.userId! },
    })
    if (!workspace) {
      response.status(404).json({ error: "Workspace not found" })
      return
    }
    const post = await prisma.post.findFirst({
      where: {
        id: String(request.params.postId),
        workspaceId: workspace.id,
        meetingRequested: true,
      },
    })
    if (!post) {
      response.status(404).json({ error: "Meeting request not found" })
      return
    }
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        meetingRequestStatus: parsed.data.status,
        meetingRequestResolutionNote:
          parsed.data.status === "REQUESTED" ? null : parsed.data.note || null,
      },
      include: postInclude,
    })
    response.json(serializeAdminPost(updated))
  } catch (error) {
    handleError(error, response)
  }
})
