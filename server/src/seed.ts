import { prisma } from "./db.js"

export const seedDemo = async () => {
  if ((await prisma.workspace.count()) > 0) return
  const owner = await prisma.user.create({
    data: { email: "hello@pulse.local", name: "Pulse team" },
  })
  const workspace = await prisma.workspace.create({
    data: {
      name: "Acme",
      slug: "acme",
      description: "Help us build a better product.",
      ownerId: owner.id,
    },
  })
  await prisma.post.createMany({
    data: [
      {
        title: "Dark mode for the dashboard",
        description: "A calmer interface for late-night work.",
        status: "PLANNED",
        authorId: owner.id,
        workspaceId: workspace.id,
      },
      {
        title: "Slack notifications",
        description: "Get updates where your team already works.",
        status: "IN_PROGRESS",
        authorId: owner.id,
        workspaceId: workspace.id,
      },
      {
        title: "Custom reporting views",
        description: "Save and share filtered dashboards.",
        status: "OPEN",
        authorId: owner.id,
        workspaceId: workspace.id,
      },
    ],
  })
}
