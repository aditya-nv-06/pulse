import { Router } from "express"
import Razorpay from "razorpay"
import { config } from "../config.js"
import { handleError, requireAuth, type AuthRequest } from "../middleware/auth.js"

export const billingRouter = Router()
billingRouter.use(requireAuth)

billingRouter.post("/checkout", async (request: AuthRequest, response) => {
  try {
    if (!config.razorpayKeyId || !config.razorpayKeySecret || !config.razorpayPlanId) {
      response.status(503).json({
        error:
          "Payments are not configured yet. Add Razorpay credentials to the server environment.",
      })
      return
    }
    const razorpay = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    })
    const subscription = await razorpay.subscriptions.create({
      plan_id: config.razorpayPlanId,
      total_count: 12,
      customer_notify: 1,
      notes: { planId: config.razorpayPlanId, userId: request.userId ?? "" },
    })
    response.json({ subscriptionId: subscription.id, keyId: config.razorpayKeyId })
  } catch (error) {
    handleError(error, response)
  }
})
