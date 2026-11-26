import cors from "cors"
import express from "express"
import { config } from "./config.js"
import { authRouter } from "./routes/auth.js"
import { publicRouter } from "./routes/public.js"
import { workspaceRouter } from "./routes/workspaces.js"
import { billingRouter } from "./routes/billing.js"
import { paymentsRouter } from "./routes/payments.js"
import { blueprintRouter } from "./routes/blueprints.js"
import { aiRouter } from "./routes/ai.js"
import { prisma } from "./db.js"

export const app = express()
app.use(cors({ origin: config.clientOrigin, credentials: true }))
app.disable("x-powered-by")
app.use(express.json({ limit: "1mb" }))
app.get("/api/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ ok: true })
  } catch {
    response.status(503).json({ ok: false })
  }
})
app.use("/api/auth", authRouter)
app.use("/api/public", publicRouter)
app.use("/api/workspaces", workspaceRouter)
app.use("/api/billing", billingRouter)
app.use("/api", paymentsRouter)
app.use("/api/workspaces", blueprintRouter)
app.use("/api/ai", aiRouter)
