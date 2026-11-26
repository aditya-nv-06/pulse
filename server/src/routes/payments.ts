import crypto from "node:crypto"
import { Router } from "express"
import { z } from "zod"
import { config } from "../config.js"
import { prisma } from "../db.js"
import { handleError, requireAuth, type AuthRequest } from "../middleware/auth.js"

export const paymentsRouter = Router()
paymentsRouter.use(requireAuth)
const paymentUnavailableMessage = "We couldn’t start your payment. Please try again shortly."
const paymentSetupMessage =
  process.env.NODE_ENV === "production"
    ? paymentUnavailableMessage
    : "Payments are not configured. Add Razorpay credentials to the server environment."

const createOrderSchema = z.object({
  amount: z.literal(221700),
  currency: z.literal("INR"),
  receipt: z.string().trim().min(1).max(40).optional(),
})

const razorpayCredentials = () => {
  if (!config.razorpayKeyId || !config.razorpayKeySecret)
    throw new Error("Razorpay credentials are not configured")
  return `Basic ${btoa(`${config.razorpayKeyId}:${config.razorpayKeySecret}`)}`
}

const getRazorpayError = (value: unknown) => {
  if (!value || typeof value !== "object") return null
  const error = value as {
    statusCode?: number | string
    error?: { code?: string; description?: string }
  }
  return {
    statusCode: error.statusCode,
    code: error.error?.code,
    description: error.error?.description,
  }
}

const razorpayRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: razorpayCredentials(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const providerBody = result && typeof result === "object" ? result : {}
    const providerError = getRazorpayError({ ...providerBody, statusCode: response.status })
    throw Object.assign(new Error(providerError?.description ?? "Razorpay request failed"), {
      statusCode: response.status,
      error: providerError
        ? { code: providerError.code, description: providerError.description }
        : undefined,
    })
  }
  return result as T
}

paymentsRouter.post("/create-order", async (request: AuthRequest, response) => {
  try {
    const parsed = createOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid order" })
      return
    }
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      console.error("Razorpay checkout is not configured on this Worker", {
        keyIdConfigured: Boolean(config.razorpayKeyId),
        keySecretConfigured: Boolean(config.razorpayKeySecret),
      })
      response.status(503).json({ error: paymentSetupMessage })
      return
    }
    const order = await razorpayRequest<{ id: string; amount: number; currency: string }>(
      "/orders",
      {
        method: "POST",
        body: JSON.stringify({
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          // Razorpay receipts must be unique and no longer than 40 characters.
          receipt:
            parsed.data.receipt ??
            `p_${Date.now().toString(36).slice(-8)}_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
          notes: { userId: request.userId ?? "" },
        }),
      },
    )
    response.status(201).json({
      key_id: config.razorpayKeyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (error) {
    const providerError = getRazorpayError(error)
    console.error(
      "Razorpay order creation failed",
      providerError ?? { message: error instanceof Error ? error.message : "Unknown error" },
    )
    if (Number(providerError?.statusCode) === 401) {
      response.status(503).json({ error: paymentSetupMessage })
      return
    }
    response.status(502).json({
      error:
        process.env.NODE_ENV === "production"
          ? paymentUnavailableMessage
          : (providerError?.description ??
            "Razorpay could not create the order. Check that your account supports INR payments and that its API credentials are valid."),
    })
  }
})

paymentsRouter.post("/verify-payment", async (request: AuthRequest, response) => {
  try {
    if (!config.razorpayKeySecret) {
      response.status(500).json({ error: "Razorpay verification is not configured" })
      return
    }
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = request.body as Record<string, unknown>
    if (
      typeof orderId !== "string" ||
      typeof paymentId !== "string" ||
      typeof signature !== "string"
    ) {
      response.status(400).json({ error: "Payment verification fields are required" })
      return
    }
    const expected = crypto
      .createHmac("sha256", config.razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex")
    const expectedBuffer = Buffer.from(expected, "utf8")
    const signatureBuffer = Buffer.from(signature, "utf8")
    const valid =
      expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    if (!valid) {
      response.status(400).json({ error: "Payment signature verification failed" })
      return
    }
    const order = await razorpayRequest<{
      amount: number
      currency: string
      notes?: { userId?: string }
    }>(`/orders/${encodeURIComponent(orderId)}`)
    if (
      order.amount !== 221700 ||
      order.currency !== "INR" ||
      order.notes?.userId !== request.userId
    ) {
      response.status(400).json({ error: "Payment order does not belong to this account" })
      return
    }
    await prisma.user.update({
      where: { id: request.userId! },
      data: {
        workspaceLimit: 2,
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    response.json({ success: true, payment_id: paymentId, order_id: orderId })
  } catch (error) {
    handleError(error, response)
  }
})
