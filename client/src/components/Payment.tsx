import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import BrandMark from "./BrandMark"
import LoadingSpinner from "./LoadingSpinner"

const Payment = () => {
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const startCheckout = async () => {
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const order = await api.createOrder(2400)
      const configuredKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID?.trim()
      if (configuredKeyId && configuredKeyId !== order.key_id) {
        throw new Error(
          "Frontend VITE_RAZORPAY_KEY_ID does not match the server RAZORPAY_KEY_ID. Update both to the same Razorpay key ID and rebuild the frontend.",
        )
      }
      const keyId = configuredKeyId || order.key_id
      if (!keyId)
        throw new Error(
          "Razorpay is not configured. Set VITE_RAZORPAY_KEY_ID in the frontend and Razorpay credentials in the server.",
        )
      const razorpay = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Pulse",
        description: "Pulse additional workspace",
        order_id: order.order_id,
        handler: (payment) => {
          void api
            .verifyPayment(payment)
            .then(async () => {
              const pendingWorkspace = localStorage.getItem("pulse_pending_workspace")
              if (pendingWorkspace) {
                const details = JSON.parse(pendingWorkspace) as { name: string; slug: string }
                await api.createWorkspace(details.name, details.slug)
                localStorage.removeItem("pulse_pending_workspace")
              }
              setMessage("Payment verified and workspace created.")
              setLoading(false)
              navigate("/dashboard/posts?upgraded=1")
            })
            .catch((verifyError) => {
              setLoading(false)
              setError(
                verifyError instanceof Error ? verifyError.message : "Payment verification failed",
              )
            })
        },
        modal: { ondismiss: () => setMessage("Payment cancelled. No charge was made.") },
      })
      razorpay.on("payment.failed", (failure) => {
        setLoading(false)
        setError(failure.error.description ?? "Payment failed. Please try again.")
      })
      razorpay.open()
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to open checkout")
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#FAFAF8] px-4 py-10 text-neutral-950 sm:px-6">
      <div className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <button
          onClick={() => navigate("/dashboard/posts")}
          className="inline-flex items-center gap-2 text-lg font-bold"
        >
          <BrandMark />
          Pulse
        </button>
        <p className="mt-10 text-sm font-bold tracking-wide text-[#625BF6]">WORKSPACE PLAN</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Create more with Pulse</h1>
        <p className="mt-3 leading-7 text-neutral-500">
          Your free plan includes one workspace. Upgrade to create additional workspaces and keep
          each product feedback loop separate.
        </p>
        <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-[#FAFAF8] p-5">
          <div>
            <p className="font-bold">Additional workspace</p>
            <p className="mt-1 text-sm text-neutral-500">Secure payment via Razorpay</p>
          </div>
          <p className="shrink-0 text-2xl font-bold">
            $24<span className="ml-1 text-sm font-medium text-neutral-500">USD</span>
          </p>
        </div>
        <button
          onClick={() => void startCheckout()}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-[#625BF6] px-4 py-3 font-semibold text-white transition hover:bg-[#625BF6] disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <LoadingSpinner className="h-4 w-4" light />
              Opening secure checkout…
            </span>
          ) : (
            "Pay $24 and continue"
          )}
        </button>
        <button
          onClick={() => navigate("/dashboard/posts")}
          className="mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-50"
        >
          Back to workspace
        </button>
        {message && (
          <p role="status" className="mt-5 text-sm text-green-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}

export default Payment
