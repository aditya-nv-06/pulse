import PublicBoardNav from "./PublicBoardNav"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { ReactNode } from "react"
import { api, ApiError } from "../api"
import CopyBoardLink from "./CopyBoardLink"
import BrandMark from "./BrandMark"
type IconName = "sparkles" | "arrow" | "up" | "comment" | "bolt" | "check"

const Icon = ({ name, size = 18 }: { name: IconName; size?: number }) => {
  const paths: Record<IconName, string> = {
    sparkles:
      "M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3zm6 11l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14z",
    arrow: "M5 12h14m-6-6l6 6-6 6",
    up: "M12 19V5m-6 6l6-6 6 6",
    comment: "M20 11.5a7.5 7.5 0 01-8 7.5 8.5 8.5 0 01-3.5-.8L4 20l1.8-4.2A7.5 7.5 0 1120 11.5z",
    bolt: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
    check: "M5 12l4 4L19 6",
  }

  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

const Button = ({
  children,
  className = "",
  onClick,
  disabled = false,
  variant = "primary",
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  variant?: "primary" | "secondary"
}) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors ${
      variant === "secondary"
        ? "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
        : "bg-[#625BF6] text-white hover:bg-[#625BF6]"
    } ${className}`}
    onClick={onClick}
    disabled={disabled}
    type="button"
  >
    {children}
  </button>
)

const Logo = () => (
  <div className="flex items-center gap-2 text-sm font-bold text-neutral-950">
    <BrandMark className="size-7" />
    Pulse
  </div>
)

const MainPage = () => {
  const navigate = useNavigate()
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialError, setTrialError] = useState("")
  const startTrial = async () => {
    setTrialLoading(true)
    setTrialError("")
    try {
      await api.getWorkspaces()
      navigate("/dashboard/posts")
    } catch (error) {
      if (
        error instanceof ApiError &&
        ["Session expired", "Authentication required"].includes(error.message)
      ) {
        navigate("/login")
      } else {
        setTrialError(error instanceof Error ? error.message : "Unable to check your sign-in")
      }
    } finally {
      setTrialLoading(false)
    }
  }
  return (
    <>
      <PublicBoardNav />
      <main>
        <section className="relative overflow-hidden px-5 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
          <div className="hero-grid absolute inset-0 -z-10 opacity-70" />
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#625BF6]/20 bg-[#625BF6]/5 px-3 py-1.5 text-xs font-semibold text-[#625BF6]">
              <Icon name="sparkles" size={14} /> Customer feedback, without the chaos
            </div>
            <h1 className="text-balance text-[48px] font-bold leading-[1.02] tracking-[-0.055em] text-neutral-950 sm:text-[64px] lg:text-[80px]">
              Build what your
              <br />
              <span className="text-[#625BF6]">customers want.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-8 text-neutral-600">
              One calm place to collect ideas, understand demand, and keep everyone in the loop as
              you ship.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <CopyBoardLink
                slug="acme"
                className="h-12 w-full justify-center rounded-xl border border-neutral-200 bg-white px-4 sm:w-auto"
              />
              <Button
                className="h-12 w-full px-6 sm:w-auto"
                variant="secondary"
                onClick={() => void startTrial()}
                disabled={trialLoading}
              >
                {trialLoading ? "Checking session…" : "Start for free"}
              </Button>
            </div>
            <p className="mt-4 text-xs text-neutral-400">
              Free for small teams · Set up in under 5 minutes
            </p>
            {trialError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {trialError}
              </p>
            )}
          </div>
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="relative rounded-[24px] border border-neutral-200 bg-white p-2 shadow-[0_32px_80px_rgba(25,23,44,.12)]">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-[#FAFAF8]">
                <div className="flex h-12 items-center border-b border-neutral-200 bg-white px-4">
                  <div className="flex gap-1.5">
                    <i className="size-2.5 rounded-full bg-neutral-200" />
                    <i className="size-2.5 rounded-full bg-neutral-200" />
                    <i className="size-2.5 rounded-full bg-neutral-200" />
                  </div>
                  <div className="mx-auto rounded-md bg-neutral-100 px-16 py-1 text-[10px] text-neutral-400">
                    feedback.loopnote.app
                  </div>
                </div>
                <div className="grid min-h-[360px] grid-cols-[180px_1fr] sm:grid-cols-[220px_1fr]">
                  <div className="hidden border-r border-neutral-200 bg-neutral-950 p-5 text-white sm:block">
                    <div className="mb-8 flex items-center gap-2 text-xs font-bold">
                      <span className="size-5 rounded-md bg-[#625BF6]" /> Acme
                    </div>
                    <div className="space-y-2 text-[11px] text-neutral-400">
                      <div className="rounded-lg bg-white/10 px-3 py-2.5 text-white">
                        Product board
                      </div>
                      <div className="px-3 py-2.5">Changelog</div>
                      <div className="px-3 py-2.5">Roadmap</div>
                    </div>
                  </div>
                  <div className="p-5 sm:p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold">Top feature requests</div>
                        <div className="text-xs text-neutral-400">
                          Help shape what we build next.
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#625BF6] px-3 py-2 text-[10px] font-bold text-white">
                        Submit feature
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        [
                          "Dark mode for the dashboard",
                          "Thoughtful support for working late.",
                          "284",
                        ],
                        [
                          "Slack notifications",
                          "Get updates where your team already works.",
                          "192",
                        ],
                        ["Custom reporting views", "Save and share filtered dashboards.", "147"],
                      ].map(([title, text, votes]) => (
                        <div
                          className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4"
                          key={title}
                        >
                          <div className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-100 text-[10px] font-bold">
                            <Icon name="up" size={14} />
                            {votes}
                          </div>
                          <div>
                            <div className="text-sm font-bold">{title}</div>
                            <div className="mt-1 text-[11px] text-neutral-400">{text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="border-y border-neutral-200 bg-white px-5 py-24 lg:px-8 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-[#625BF6] font-medium">A clearer feedback loop</p>
              <h2 className="font-bold text-2xl">
                From scattered opinions
                <br />
                to confident decisions.
              </h2>
            </div>
            <div className="mt-16 grid gap-5 lg:grid-cols-3">
              {[
                {
                  icon: "comment" as IconName,
                  n: "01",
                  title: "Collect in one place",
                  text: "Give customers a focused space to share ideas, add context, and vote for what matters.",
                },
                {
                  icon: "bolt" as IconName,
                  n: "02",
                  title: "Spot the signal",
                  text: "Prioritize with real demand, not the loudest voice. Filter feedback by segment and status.",
                },
                {
                  icon: "sparkles" as IconName,
                  n: "03",
                  title: "Close the loop",
                  text: "Share progress automatically and turn every release into a reason for customers to return.",
                },
              ].map((feature) => (
                <article
                  className="group rounded-3xl border border-neutral-200 bg-[#FAFAF8] p-8 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-neutral-200/60"
                  key={feature.title}
                >
                  <div className="mb-16 flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-[#625BF6] text-white">
                      <Icon name={feature.icon} />
                    </span>
                    <span className="text-xs font-bold text-neutral-300">{feature.n}</span>
                  </div>
                  <h3 className="text-xl font-bold tracking-[-0.025em]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-500">{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-12 rounded-[32px] bg-neutral-950 p-8 text-white md:p-14 lg:grid-cols-[1fr_440px]">
            <div>
              <p className="eyebrow text-[#A3A3A3]">Simple pricing</p>
              <h2 className="mt-3 max-w-xl text-4xl font-bold tracking-[-0.045em] sm:text-5xl">
                Start listening today. Scale when you’re ready.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-neutral-400">
                Everything you need to build a better product with your customers, not just for
                them.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-7 text-neutral-950">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">Team plan</p>
                  <p className="mt-1 text-sm text-neutral-500">For growing product teams</p>
                </div>
                <span className="rounded-full bg-[#625BF6]/10 px-3 py-1 text-xs font-bold text-[#625BF6]">
                  14 days free
                </span>
              </div>
              <div className="my-7 flex items-end gap-1">
                <span className="text-5xl font-bold tracking-[-0.05em]">$29</span>
                <span className="pb-1.5 text-sm text-neutral-400">/ month</span>
              </div>
              <div className="mb-7 grid gap-3 text-sm">
                {["Unlimited feedback", "Public board & changelog"].map((item) => (
                  <div className="flex items-center gap-2.5" key={item}>
                    <span className="grid size-5 place-items-center rounded-full bg-[#625BF6]/10 text-[#625BF6]">
                      <Icon name="check" size={13} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
              <Button
                className="h-12 w-full"
                onClick={() => void startTrial()}
                disabled={trialLoading}
              >
                {trialLoading ? "Checking session…" : "Start your free trial"}{" "}
                <Icon name="arrow" size={16} />
              </Button>
              {trialError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {trialError}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-neutral-200 px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo />
          <p className="text-xs text-neutral-400">© 2026 Pulse. Built for better products.</p>
        </div>
      </footer>
    </>
  )
}

export default MainPage
