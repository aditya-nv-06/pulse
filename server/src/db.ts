import { AsyncLocalStorage } from "node:async_hooks"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { config } from "./config.js"

const requestClient = new AsyncLocalStorage<PrismaClient>()

export const createPrismaClient = (connectionString: string) => {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

let localClient: PrismaClient | undefined
const getClient = () => {
  const currentClient = requestClient.getStore()
  if (currentClient) return currentClient
  if (!config.databaseUrl) throw new Error("DATABASE_URL is required to connect to PostgreSQL")
  localClient ??= createPrismaClient(config.databaseUrl)
  return localClient
}

export const runWithPrismaClient = <T>(client: PrismaClient, callback: () => T) =>
  requestClient.run(client, callback)

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient()
    const value = Reflect.get(client, property, client) as unknown
    return typeof value === "function" ? value.bind(client) : value
  },
})
