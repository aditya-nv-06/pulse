export type PostStatus = "OPEN" | "PLANNED" | "IN_PROGRESS" | "SHIPPED"
export type MeetingRequestStatus = "REQUESTED" | "COMPLETED" | "REJECTED"

export type Post = {
  id: string
  title: string
  description: string
  status: PostStatus
  teamReply: string | null
  votes: number
  author: string
  authorEmail?: string
  meetingRequested?: boolean
  meetingRequestStatus?: MeetingRequestStatus | null
  meetingRequestResolutionNote?: string | null
  shippedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type Workspace = {
  id: string
  name: string
  slug: string
  description: string | null
  meetingRequestsEnabled?: boolean
}
export type GoogleSheetsSettings = { enabled: boolean; webhookUrl: string }
export type MeetingRequestSettings = { enabled: boolean }
export type WorkspaceAnalytics = {
  days: 7 | 30 | 90
  summary: {
    totalRequests: number
    totalVotes: number
    replyRate: number
    statuses: Record<PostStatus, number>
  }
  current: { requests: number; votes: number; meetingRequests: number }
  previous: { requests: number; votes: number; meetingRequests: number }
  trends: { date: string; requests: number; votes: number; meetingRequests: number }[]
  topFeatures: { id: string; title: string; status: PostStatus; votes: number }[]
  shippedFeatures: {
    id: string
    title: string
    description: string
    shippedAt: string
    votes: number
  }[]
}

export type ChangelogEntry = {
  id: string
  title: string
  body: string
  publishedAt: string
}

export type PublicBoard = {
  workspace: Workspace
  posts: Post[]
  changelog: ChangelogEntry[]
}

export type BlueprintPlan = {
  name: string
  summary: string
  targetUsers: string
  coreFeatures: string[]
  scale: string
  techStack: string
  constraints: string
  integrations: string
}
export type BlueprintNode = {
  id: string
  label: string
  type: "user" | "service" | "database" | "external" | "queue" | "process"
  feature?: string
  position?: { x: number; y: number }
}
export type BlueprintEdge = { id: string; source: string; target: string; label?: string }
export type BlueprintResult = {
  blueprint: { id: string; planInput: BlueprintPlan }
  version: {
    id: string
    version: number
    note?: string | null
    nodes?: BlueprintNode[]
    edges?: BlueprintEdge[]
  }
  graph: { nodes: BlueprintNode[]; edges: BlueprintEdge[] }
}

const apiUrl = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "")
const apiUnavailableMessage =
  "Pulse API is unavailable. Start the server on port 4000 and try again."
export class ApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    })
  } catch {
    throw new Error(apiUnavailableMessage)
  }

  const raw = await response.text()
  let data: T & { error?: string; code?: string }
  try {
    data = JSON.parse(raw) as T & { error?: string; code?: string }
  } catch {
    throw new Error(
      response.ok
        ? "Pulse returned an unreadable response."
        : `Pulse request failed (${response.status}).`,
    )
  }
  if (!response.ok)
    throw new ApiError(data.error ?? `Pulse request failed (${response.status}).`, data.code)
  return data
}

export const auth = {
  async requestLink(email: string) {
    return request<{ message: string }>("/auth/request-link", {
      method: "POST",
      body: JSON.stringify({ email, returnTo: "/dashboard/posts" }),
    })
  },
}

export const api = {
  logout: async () => {
    const result = await request<{ ok: boolean }>("/auth/logout", { method: "POST" })
    localStorage.removeItem("pulse_token")
    return result
  },
  getWorkspace: () => request<Workspace | null>("/workspaces/me"),
  getWorkspaces: () => request<Workspace[]>("/workspaces"),
  createWorkspace: (name: string, slug: string) =>
    request<Workspace>("/workspaces", { method: "POST", body: JSON.stringify({ name, slug }) }),
  getBoard: (slug: string, search = "", sort = "top") =>
    request<PublicBoard>(`/public/${slug}?search=${encodeURIComponent(search)}&sort=${sort}`),
  getAdminPosts: (slug: string) => request<Post[]>(`/workspaces/${slug}/posts`),
  getAnalytics: (slug: string, days: 7 | 30 | 90) =>
    request<WorkspaceAnalytics>(`/workspaces/${slug}/analytics?days=${days}`),
  getGoogleSheetsSettings: (slug: string) =>
    request<GoogleSheetsSettings>(`/workspaces/${slug}/integrations/google-sheets`),
  updateGoogleSheetsSettings: (slug: string, settings: GoogleSheetsSettings) =>
    request<GoogleSheetsSettings>(`/workspaces/${slug}/integrations/google-sheets`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  getMeetingRequestSettings: (slug: string) =>
    request<MeetingRequestSettings>(`/workspaces/${slug}/meeting-requests/settings`),
  updateMeetingRequestSettings: (slug: string, enabled: boolean) =>
    request<MeetingRequestSettings>(`/workspaces/${slug}/meeting-requests/settings`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
  getMeetingRequests: (slug: string) => request<Post[]>(`/workspaces/${slug}/meeting-requests`),
  updateMeetingRequest: (slug: string, postId: string, status: MeetingRequestStatus, note = "") =>
    request<Post>(`/workspaces/${slug}/meeting-requests/${postId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),
  getAdminPost: (slug: string, postId: string) =>
    request<Post>(`/workspaces/${slug}/posts/${postId}`),
  createPost: (
    slug: string,
    title: string,
    description: string,
    email: string,
    meetingRequested = false,
  ) =>
    request<Post>(`/public/${slug}/posts`, {
      method: "POST",
      body: JSON.stringify({ title, description, email, meetingRequested }),
    }),
  vote: (postId: string) => {
    const voterKey = localStorage.getItem("pulse_voter") ?? crypto.randomUUID()
    localStorage.setItem("pulse_voter", voterKey)
    return request<{ votes: number }>(`/public/posts/${postId}/vote`, {
      method: "POST",
      body: JSON.stringify({ voterKey }),
    })
  },
  updateStatus: (slug: string, postId: string, status: PostStatus) =>
    request<Post>(`/workspaces/${slug}/posts/${postId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  reply: (slug: string, postId: string, reply: string) =>
    request<Post>(`/workspaces/${slug}/posts/${postId}/reply`, {
      method: "POST",
      body: JSON.stringify({ reply }),
    }),
  merge: (slug: string, postId: string, targetId: string) =>
    request<{ merged: boolean }>(`/workspaces/${slug}/posts/${postId}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetId }),
    }),
  publishChangelog: (slug: string, title: string, body: string, postIds: string[]) =>
    request<ChangelogEntry>(`/workspaces/${slug}/changelog`, {
      method: "POST",
      body: JSON.stringify({ title, body, postIds }),
    }),
  createCheckout: () =>
    request<{ subscriptionId: string; keyId: string }>("/billing/checkout", { method: "POST" }),
  createOrder: (amount: 221700) =>
    request<{ key_id: string; order_id: string; amount: number; currency: string }>(
      "/create-order",
      { method: "POST", body: JSON.stringify({ amount, currency: "INR" }) },
    ),
  verifyPayment: (payload: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) =>
    request<{ success: boolean }>("/verify-payment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getBlueprint: (slug: string) => request<BlueprintResult | null>(`/workspaces/${slug}/blueprint`),
  generateBlueprint: (slug: string, plan: BlueprintPlan) =>
    request<BlueprintResult>(`/workspaces/${slug}/blueprint/generate`, {
      method: "POST",
      body: JSON.stringify(plan),
    }),
  saveBlueprint: (slug: string, graph: { nodes: BlueprintNode[]; edges: BlueprintEdge[] }) =>
    request<{
      version: { id: string; version: number }
      graph: { nodes: BlueprintNode[]; edges: BlueprintEdge[] }
    }>(`/workspaces/${slug}/blueprint`, { method: "PUT", body: JSON.stringify(graph) }),
  generateImage: (prompt: string, resolution: "1k" | "2k" = "1k") =>
    request<{ image: string }>("/ai/image", {
      method: "POST",
      body: JSON.stringify({ prompt, resolution }),
    }),
}
