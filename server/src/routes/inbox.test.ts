import type { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { inboxWorkspaceAccessStatus, resolveInboxSuggestion } from "./inbox.js"

const { fakePrisma } = vi.hoisted(() => ({
  fakePrisma: {
    workspace: { findUnique: vi.fn() },
    inboxItem: { findFirst: vi.fn(), count: vi.fn() },
  },
}))

vi.mock("../db.js", () => ({ prisma: fakePrisma }))
type TestItem = {
  id: string
  workspaceId: string
  status: "NEW" | "LINKED" | "CREATED" | "DISCARDED"
  suggestion: { requests: Array<Record<string, unknown>> } | null
  requesterName: string | null
  requesterEmail: string | null
  resultPostId: string | null
  processedAt: Date | null
}

const testSuggestion = (title: string) => ({
  title,
  summary: `${title} summary`,
  matchedPostId: "post-a",
  confidence: 0.9,
})

const makeTransaction = (
  items: TestItem[],
  postRows = [{ id: "post-a", workspaceId: "ws-a", voteCount: 0 }],
) => {
  const requesterRows = new Map<string, { id: string; workspaceId: string; email?: string }>()
  const postRequesterRows = new Set<string>()
  const posts = new Map(
    postRows.map((post) => [post.id, { ...post, mergedIntoId: null as string | null }]),
  )
  let id = 0
  const transaction = {
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => []),
    inboxItem: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; workspaceId: string } }) =>
          items.find((item) => item.id === where.id && item.workspaceId === where.workspaceId) ??
          null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<TestItem> }) => {
        const item = items.find((entry) => entry.id === where.id)!
        Object.assign(item, data)
        return item
      }),
    },
    post: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; workspaceId: string } }) => {
        const post = posts.get(where.id)
        return post?.workspaceId === where.workspaceId && !post.mergedIntoId
          ? { id: post.id }
          : null
      }),
      create: vi.fn(async ({ data }: { data: { workspaceId: string } }) => {
        const post = {
          id: `created-${++id}`,
          workspaceId: data.workspaceId,
          voteCount: 0,
          mergedIntoId: null,
        }
        posts.set(post.id, post)
        return { id: post.id }
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string }
          data: { voteCount: { increment: number } }
        }) => {
          const post = posts.get(where.id)!
          post.voteCount += data.voteCount.increment
          return post
        },
      ),
    },
    requester: {
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { workspaceId_email: { workspaceId: string; email: string } }
          create: { workspaceId: string; email: string }
        }) => {
          const key = `${where.workspaceId_email.workspaceId}:${where.workspaceId_email.email}`
          if (!requesterRows.has(key))
            requesterRows.set(key, { id: `requester-${++id}`, ...create })
          return { id: requesterRows.get(key)!.id }
        },
      ),
      create: vi.fn(async ({ data }: { data: { workspaceId: string } }) => {
        const requester = { id: `requester-${++id}`, ...data }
        requesterRows.set(requester.id, requester)
        return { id: requester.id }
      }),
    },
    postRequester: {
      createMany: vi.fn(
        async ({ data }: { data: Array<{ postId: string; requesterId: string }> }) => {
          let count = 0
          for (const row of data) {
            const key = `${row.postId}:${row.requesterId}`
            if (postRequesterRows.has(key)) continue
            postRequesterRows.add(key)
            count += 1
          }
          return { count }
        },
      ),
    },
  }
  return {
    transaction: transaction as unknown as Prisma.TransactionClient,
    posts,
    postRequesterRows,
  }
}

describe("Inbox workspace authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakePrisma.workspace.findUnique.mockResolvedValue({ id: "ws-a", ownerId: "owner" })
  })

  it("denies users outside a workspace and hides missing workspaces", () => {
    expect(inboxWorkspaceAccessStatus({ ownerId: "owner" }, "outsider")).toBe(403)
    expect(inboxWorkspaceAccessStatus({ ownerId: "owner" }, "owner")).toBeNull()
    expect(inboxWorkspaceAccessStatus(null, "outsider")).toBe(404)
  })
})

describe("Inbox resolve transaction", () => {
  const makeItem = (
    requests: Array<Record<string, unknown>> = [testSuggestion("Add search")],
  ): TestItem => ({
    id: "item-a",
    workspaceId: "ws-a",
    status: "NEW",
    suggestion: { requests },
    requesterName: "Casey",
    requesterEmail: "casey@example.com",
    resultPostId: null,
    processedAt: null,
  })

  const resolve = (
    transaction: Prisma.TransactionClient,
    itemId: string,
    workspaceId: string,
    input:
      | { action: "link"; postId: string; suggestionIndex: number }
      | { action: "create"; title: string; body?: string; suggestionIndex: number }
      | { action: "discard"; suggestionIndex: number },
  ) => resolveInboxSuggestion(transaction, { id: itemId, workspaceId, userId: "owner", input })

  it("links a request and adds one vote for its new requester attachment", async () => {
    const item = makeItem()
    const fake = makeTransaction([item])
    await resolve(fake.transaction, item.id, "ws-a", {
      action: "link",
      postId: "post-a",
      suggestionIndex: 0,
    })
    expect(fake.posts.get("post-a")?.voteCount).toBe(1)
    expect(item.status).toBe("LINKED")
  })

  it("creates a post and attaches its requester within the same transaction", async () => {
    const item = makeItem()
    const fake = makeTransaction([item])
    await resolve(fake.transaction, item.id, "ws-a", {
      action: "create",
      title: "Add search",
      body: "Search feedback",
      suggestionIndex: 0,
    })
    expect(fake.posts.get("created-1")?.voteCount).toBe(1)
    expect(item.status).toBe("CREATED")
  })

  it("discards without creating a post or requester", async () => {
    const item = makeItem()
    const fake = makeTransaction([item])
    await resolve(fake.transaction, item.id, "ws-a", { action: "discard", suggestionIndex: 0 })
    expect(item.status).toBe("DISCARDED")
    expect(fake.posts.size).toBe(1)
    expect(fake.postRequesterRows.size).toBe(0)
  })

  it("rejects a second resolve of an already processed item", async () => {
    const item = makeItem()
    const fake = makeTransaction([item])
    const input = { action: "link" as const, postId: "post-a", suggestionIndex: 0 }
    await resolve(fake.transaction, item.id, "ws-a", input)
    await expect(resolve(fake.transaction, item.id, "ws-a", input)).rejects.toMatchObject({
      status: 409,
    })
    expect(fake.posts.get("post-a")?.voteCount).toBe(1)
  })

  it("does not double-count a requester linked to the same post twice", async () => {
    const item = makeItem([testSuggestion("Add search"), testSuggestion("Search from mobile")])
    const fake = makeTransaction([item])
    await resolve(fake.transaction, item.id, "ws-a", {
      action: "link",
      postId: "post-a",
      suggestionIndex: 0,
    })
    await resolve(fake.transaction, item.id, "ws-a", {
      action: "link",
      postId: "post-a",
      suggestionIndex: 1,
    })
    expect(fake.posts.get("post-a")?.voteCount).toBe(1)
    expect(fake.postRequesterRows.size).toBe(1)
  })

  it("cannot resolve an item through another workspace", async () => {
    const item = makeItem()
    const fake = makeTransaction([item])
    await expect(
      resolve(fake.transaction, item.id, "ws-b", { action: "discard", suggestionIndex: 0 }),
    ).rejects.toMatchObject({ status: 404 })
    expect(item.status).toBe("NEW")
    expect(fake.transaction.$queryRaw).toHaveBeenCalledWith(expect.anything(), "item-a", "ws-b")
  })

  it("calculates public vote totals from votes and attached requesters", async () => {
    const { calculatePostVoteCount } = await import("../lib/vote-count.js")
    expect(calculatePostVoteCount(7, 3)).toBe(10)
    expect(calculatePostVoteCount(7, 0)).toBe(7)
  })
})
