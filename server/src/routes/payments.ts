import crypto from "node:crypto"
import { Router } from "express"
import Razorpay from "razorpay"
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
  amount: z.literal(2400),
  currency: z.literal("USD"),
  receipt: z.string().trim().min(1).max(40).optional(),
})

const razorpayClient = () => {
  if (!config.razorpayKeyId || !config.razorpayKeySecret)
    throw new Error("Razorpay credentials are not configured")
  return new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret })
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

paymentsRouter.post("/create-order", async (request: AuthRequest, response) => {
  try {
    const parsed = createOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid order" })
      return
    }
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      response.status(503).json({ error: paymentSetupMessage })
      return
    }
    const razorpay = razorpayClient()
    const order = await razorpay.orders.create({
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      // Razorpay receipts must be unique and no longer than 40 characters.
      receipt:
        parsed.data.receipt ??
        `p_${Date.now().toString(36).slice(-8)}_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
      notes: { userId: request.userId ?? "" },
    })
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
            "Razorpay could not create the order. Check that your account supports USD payments and that its API credentials are valid."),
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
    const razorpay = razorpayClient()
    const order = await razorpay.orders.fetch(orderId)
    if (
      order.amount !== 2400 ||
      order.currency !== "USD" ||
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
