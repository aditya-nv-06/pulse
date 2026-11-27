import type { Prisma } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"
import { mergePosts, PostMergeError } from "./mergePosts.js"

const makeTransaction = () => {
  const posts = new Map([
    [
      "source",
      { id: "source", workspaceId: "ws-a", mergedIntoId: null as string | null, voteCount: 2 },
    ],
    [
      "target",
      { id: "target", workspaceId: "ws-a", mergedIntoId: null as string | null, voteCount: 3 },
    ],
    [
      "foreign",
      { id: "foreign", workspaceId: "ws-b", mergedIntoId: null as string | null, voteCount: 0 },
    ],
  ])
  const votes = [
    {
      id: "source-v1",
      postId: "source",
      voterKey: "shared-voter",
      userId: null,
      createdAt: new Date(1),
    },
    {
      id: "source-v2",
      postId: "source",
      voterKey: "source-voter",
      userId: null,
      createdAt: new Date(2),
    },
    {
      id: "target-v1",
      postId: "target",
      voterKey: "shared-voter",
      userId: null,
      createdAt: new Date(3),
    },
  ]
  const postRequesters = [
    { postId: "source", requesterId: "requester-shared" },
    { postId: "source", requesterId: "requester-new" },
    { postId: "target", requesterId: "requester-shared" },
  ]
  const transaction = {
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => []),
    post: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; workspaceId: string } }) => {
        const post = posts.get(where.id)
        return post?.workspaceId === where.workspaceId && !post.mergedIntoId
          ? { id: post.id }
          : null
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string }
          data: { voteCount?: number; mergedIntoId?: string }
        }) => {
          const post = posts.get(where.id)!
          if (data.voteCount !== undefined) post.voteCount = data.voteCount
          if (data.mergedIntoId !== undefined) post.mergedIntoId = data.mergedIntoId
          return post
        },
      ),
    },
    vote: {
      findMany: vi.fn(async ({ where }: { where: { postId: string } }) =>
        votes.filter((vote) => vote.postId === where.postId),
      ),
      createMany: vi.fn(async ({ data }: { data: typeof votes }) => {
        for (const vote of data) {
          if (
            !votes.some(
              (existing) => existing.postId === vote.postId && existing.voterKey === vote.voterKey,
            )
          )
            votes.push({ ...vote, id: `moved-${vote.id}` })
        }
        return { count: data.length }
      }),
      deleteMany: vi.fn(async ({ where }: { where: { postId: string } }) => {
        const countBefore = votes.length
        for (let index = votes.length - 1; index >= 0; index -= 1)
          if (votes[index]?.postId === where.postId) votes.splice(index, 1)
        return { count: countBefore - votes.length }
      }),
      count: vi.fn(
        async ({ where }: { where: { postId: string } }) =>
          votes.filter((vote) => vote.postId === where.postId).length,
      ),
    },
    postRequester: {
      findMany: vi.fn(async ({ where }: { where: { postId: string } }) =>
        postRequesters
          .filter((requester) => requester.postId === where.postId)
          .map(({ requesterId }) => ({ requesterId })),
      ),
      createMany: vi.fn(
        async ({ data }: { data: Array<{ postId: string; requesterId: string }> }) => {
          for (const relation of data)
            if (
              !postRequesters.some(
                (existing) =>
                  existing.postId === relation.postId &&
                  existing.requesterId === relation.requesterId,
              )
            )
              postRequesters.push(relation)
          return { count: data.length }
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { postId: string } }) => {
        for (let index = postRequesters.length - 1; index >= 0; index -= 1)
          if (postRequesters[index]?.postId === where.postId) postRequesters.splice(index, 1)
        return { count: 0 }
      }),
      count: vi.fn(
        async ({ where }: { where: { postId: string } }) =>
          postRequesters.filter((requester) => requester.postId === where.postId).length,
      ),
    },
  }
  return {
    transaction: transaction as unknown as Prisma.TransactionClient,
    posts,
    votes,
    postRequesters,
  }
}

describe("post merging with requesters", () => {
  it("moves requesters and recomputes votes without double-counting duplicates", async () => {
    const fake = makeTransaction()
    await mergePosts(fake.transaction, {
      workspaceId: "ws-a",
      sourceId: "source",
      targetId: "target",
    })

    expect(fake.votes.filter((vote) => vote.postId === "target")).toHaveLength(2)
    expect(fake.postRequesters.filter((item) => item.postId === "target")).toHaveLength(2)
    expect(fake.posts.get("target")?.voteCount).toBe(4)
    expect(fake.posts.get("source")?.voteCount).toBe(0)
    expect(fake.posts.get("source")?.mergedIntoId).toBe("target")
  })

  it("rejects a post from a different workspace", async () => {
    const fake = makeTransaction()
    await expect(
      mergePosts(fake.transaction, {
        workspaceId: "ws-a",
        sourceId: "source",
        targetId: "foreign",
      }),
    ).rejects.toBeInstanceOf(PostMergeError)
  })
})
