import { app } from "./app.js"
import { config } from "./config.js"
import { prisma } from "./db.js"
import { seedDemo } from "./seed.js"
import type { Server } from "node:http"

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const connectToDatabase = async () => {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is required to connect to PostgreSQL")
  const database = new URL(config.databaseUrl)
  const address = `${database.hostname}:${database.port || "5432"}`
  const attempts = 6

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect()
      return
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(
          `Could not connect to PostgreSQL at ${address}. Ensure the database is running and DATABASE_URL is correct.`,
          { cause: error },
        )
      }
      const delay = Math.min(1000 * 2 ** (attempt - 1), 5000)
      console.warn(
        `PostgreSQL at ${address} is not ready (attempt ${attempt}/${attempts}); retrying in ${delay / 1000}s.`,
      )
      await wait(delay)
    }
  }
}

let httpServer: Server | undefined

const shutdown = async (signal: string) => {
  console.log(`${signal} received; shutting down Pulse API`)
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer!.close(() => resolve()))
  }
  await prisma.$disconnect()
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM")
})
process.once("SIGINT", () => {
  void shutdown("SIGINT")
})

connectToDatabase()
  .then(async () => {
    if (!config.isProduction && process.env.SEED_DEMO === "true") await seedDemo()
  })
  .then(() => {
    httpServer = app.listen(config.port, "0.0.0.0", () =>
      console.log(`Pulse API listening on port ${config.port}`),
    )
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
