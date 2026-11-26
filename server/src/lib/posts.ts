import { PostStatus, type Prisma } from "@prisma/client"

export const postInclude = {
  author: { select: { name: true, email: true } },
  _count: { select: { votes: true } },
} as const

export type PostWithCounts = Prisma.PostGetPayload<{ include: typeof postInclude }>

export const serializePost = (post: PostWithCounts) => ({
  id: post.id,
  title: post.title,
  description: post.description,
  status: post.status,
  teamReply: post.teamReply,
  votes: post._count.votes,
  author: post.author.name ?? post.author.email.split("@")[0],
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
})

export const serializeAdminPost = (post: PostWithCounts) => ({
  ...serializePost(post),
  authorEmail: post.author.email,
  meetingRequested: post.meetingRequested,
  meetingRequestStatus: post.meetingRequestStatus,
  meetingRequestResolutionNote: post.meetingRequestResolutionNote,
  shippedAt: post.shippedAt,
})

export const isPostStatus = (value: unknown): value is PostStatus =>
  Object.values(PostStatus).includes(value as PostStatus)
