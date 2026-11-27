import { Router } from "express"
import { prisma } from "../db.js"
import { handleError } from "../middleware/auth.js"
import { postInclude, serializePost } from "../lib/posts.js"
import { addFeedbackFeatureToBlueprint } from "../services/blueprint-sync.js"
import { sendGoogleSheetsFeature } from "../services/google-sheets.js"
import { sendFounderMeetingRequestNotice } from "../services/email.js"
import { runInBackground } from "../lib/background.js"
import { z } from "zod"

export const publicRouter = Router()
const publicEmailSchema = z.string().trim().toLowerCase().max(254).email()

publicRouter.get("/:slug/changelog", async (request, response) => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: request.params.slug },
      select: { id: true, name: true, slug: true },
    })
    if (!workspace) {
      response.status(404).json({ error: "Changelog not found" })
      return
    }
    const entries = await prisma.changelogEntry.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { publishedAt: "desc" },
    })
    response.setHeader("Cache-Control", "no-store").json({ workspace, entries })
  } catch (error) {
    handleError(error, response)
  }
})

publicRouter.get("/:slug", async (request, response) => {
  try {
    const workspace = await prisma.workspace.findUnique({ where: { slug: request.params.slug } })
    if (!workspace) {
      response.status(404).json({ error: "Board not found" })
      return
    }
    const search = String(request.query.search ?? "").trim()
    const sort = request.query.sort === "new" ? "new" : "top"
    const posts = await prisma.post.findMany({
      where: {
        workspaceId: workspace.id,
        mergedIntoId: null,
        ...(search
          ? { OR: [{ title: { contains: search } }, { description: { contains: search } }] }
          : {}),
      },
      include: postInclude,
      orderBy: sort === "new" ? { createdAt: "desc" } : { votes: { _count: "desc" } },
    })
    const changelog = await prisma.changelogEntry.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { publishedAt: "desc" },
      take: 3,
    })
    response.setHeader("Cache-Control", "no-store").json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        meetingRequestsEnabled: workspace.meetingEnabled,
      },
      posts: posts.map(serializePost),
      changelog,
    })
  } catch (error) {
    handleError(error, response)
  }
})

publicRouter.post("/:slug/posts", async (request, response) => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: request.params.slug },
      include: { owner: { select: { email: true } } },
    })
    const title = String(request.body.title ?? "").trim()
    const description = String(request.body.description ?? "").trim()
    const parsedEmail = publicEmailSchema.safeParse(request.body.email)
    const email = parsedEmail.success ? parsedEmail.data : ""
    if (!workspace || !title || !description || !email) {
      response.status(400).json({ error: "Title, details, and a valid email are required" })
      return
    }
    const author = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: email.split("@")[0] ?? null },
    })
    const meetingRequested = request.body.meetingRequested === true && workspace.meetingEnabled
    const duplicate = await prisma.post.findFirst({
      where: {
        workspaceId: workspace.id,
        authorId: author.id,
        title: { equals: title, mode: "insensitive" },
        description: { equals: description, mode: "insensitive" },
        mergedIntoId: null,
      },
      include: postInclude,
    })
    if (duplicate) {
      const shouldNotifyFounder =
        meetingRequested &&
        (!duplicate.meetingRequested || duplicate.meetingRequestStatus !== "REQUESTED")
      const existing = shouldNotifyFounder
        ? await prisma.post.update({
            where: { id: duplicate.id },
            data: {
              meetingRequested: true,
              meetingRequestStatus: "REQUESTED",
              meetingRequestResolutionNote: null,
            },
            include: postInclude,
          })
        : duplicate
      if (shouldNotifyFounder) {
        runInBackground(
          sendFounderMeetingRequestNotice({
            founderEmail: workspace.owner.email,
            requesterName: author.name ?? email.split("@")[0] ?? "Customer",
            requesterEmail: email,
            featureTitle: existing.title,
            featureDescription: existing.description,
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug,
            postId: existing.id,
          }),
          "Founder meeting request notification failed",
        )
      }
      response.status(200).json(serializePost(existing))
      return
    }
    const post = await prisma.post.create({
      data: {
        title,
        description,
        authorId: author.id,
        workspaceId: workspace.id,
        meetingRequested,
        meetingRequestStatus: meetingRequested ? "REQUESTED" : null,
      },
      include: postInclude,
    })
    const serialized = serializePost(post)
    if (meetingRequested) {
      runInBackground(
        sendFounderMeetingRequestNotice({
          founderEmail: workspace.owner.email,
          requesterName: author.name ?? email.split("@")[0] ?? "Customer",
          requesterEmail: email,
          featureTitle: title,
          featureDescription: description,
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug,
          postId: post.id,
        }),
        "Founder meeting request notification failed",
      )
    }
    try {
      await addFeedbackFeatureToBlueprint(workspace.id, { id: post.id, title, description })
    } catch (error) {
      console.error("Unable to add public feature request to architecture whiteboard", error)
    }
    const googleSheetsWebhookUrl = workspace.googleSheetsWebhookUrl
    if (workspace.googleSheetsEnabled && googleSheetsWebhookUrl) {
      runInBackground(
        sendGoogleSheetsFeature(googleSheetsWebhookUrl, workspace, {
          id: serialized.id,
          title: serialized.title,
          description: serialized.description,
          author: serialized.author ?? "Customer",
          status: serialized.status,
          createdAt: serialized.createdAt.toISOString(),
        }),
        "Google Sheets feature webhook delivery failed",
      )
    }
    response.status(201).json(serialized)
  } catch (error) {
    handleError(error, response)
  }
})

publicRouter.post("/posts/:postId/vote", async (request, response) => {
  try {
    const voterKey = String(request.body.voterKey ?? "").trim()
    if (!voterKey) {
      response.status(400).json({ error: "A voter identity is required" })
      return
    }
    await prisma.vote.create({ data: { postId: request.params.postId, voterKey } })
    response
      .status(201)
      .json({ votes: await prisma.vote.count({ where: { postId: request.params.postId } }) })
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      response.status(409).json({ error: "You already voted for this post" })
      return
    }
    handleError(error, response)
  }
})
