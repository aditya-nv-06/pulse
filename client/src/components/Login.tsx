import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { auth } from "../api"
import BrandMark from "./BrandMark"

const Login = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSending(true)
    try {
      const result = await auth.requestLink(email)
      setMessage(
        `${result.message} Email acceptance does not confirm inbox delivery. The link expires in 15 minutes and can only be used once.`,
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8] px-6 py-16 text-neutral-950">
      <div className="mx-auto max-w-md rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-lg font-bold"
        >
          <BrandMark />
          Pulse
        </button>
        <p className="mt-12 text-sm font-bold text-[#625BF6]">WELCOME BACK</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Sign in to your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-500">
          Enter your email and we’ll send you a secure sign-in link. Open it to start your session.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-[#625BF6]"
          />
          <button
            disabled={isSending}
            className="w-full rounded-xl bg-[#625BF6] px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {isSending ? "Sending…" : "Send magic link"}
          </button>
        </form>
        {message && (
          <p role="status" className="mt-4 text-sm text-green-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}

export default Login
