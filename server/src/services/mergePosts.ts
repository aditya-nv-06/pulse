import type { Prisma } from "@prisma/client"
import { calculatePostVoteCount } from "../lib/vote-count.js"

export class PostMergeError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export const mergePosts = async (
  transaction: Prisma.TransactionClient,
  args: { workspaceId: string; sourceId: string; targetId: string },
) => {
  const { workspaceId, sourceId, targetId } = args
  if (sourceId === targetId) throw new PostMergeError("Choose another post in this workspace")
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Post"
    WHERE ("id" = ${sourceId} OR "id" = ${targetId}) AND "workspaceId" = ${workspaceId}
    ORDER BY "id"
    FOR UPDATE
  `
  const [source, target] = await Promise.all([
    transaction.post.findFirst({
      where: { id: sourceId, workspaceId, mergedIntoId: null },
      select: { id: true },
    }),
    transaction.post.findFirst({
      where: { id: targetId, workspaceId, mergedIntoId: null },
      select: { id: true },
    }),
  ])
  if (!source || !target) throw new PostMergeError("Choose another post in this workspace")

  const [sourceVotes, targetVotes, sourceRequesters] = await Promise.all([
    transaction.vote.findMany({ where: { postId: sourceId } }),
    transaction.vote.findMany({ where: { postId: targetId }, select: { voterKey: true } }),
    transaction.postRequester.findMany({
      where: { postId: sourceId },
      select: { requesterId: true },
    }),
  ])
  const targetVoterKeys = new Set(targetVotes.map((vote) => vote.voterKey))
  await transaction.vote.createMany({
    data: sourceVotes
      .filter((vote) => !targetVoterKeys.has(vote.voterKey))
      .map((vote) => ({
        postId: targetId,
        voterKey: vote.voterKey,
        userId: vote.userId,
        createdAt: vote.createdAt,
      })),
    skipDuplicates: true,
  })
  await transaction.vote.deleteMany({ where: { postId: sourceId } })
  await transaction.postRequester.createMany({
    data: sourceRequesters.map(({ requesterId }) => ({ postId: targetId, requesterId })),
    skipDuplicates: true,
  })
  await transaction.postRequester.deleteMany({ where: { postId: sourceId } })
  const [voteCount, requesterCount] = await Promise.all([
    transaction.vote.count({ where: { postId: targetId } }),
    transaction.postRequester.count({ where: { postId: targetId } }),
  ])
  await transaction.post.update({
    where: { id: targetId },
    data: { voteCount: calculatePostVoteCount(voteCount, requesterCount) },
  })
  await transaction.post.update({
    where: { id: sourceId },
    data: { mergedIntoId: targetId, voteCount: 0 },
  })
  return { merged: true as const, targetId }
}
