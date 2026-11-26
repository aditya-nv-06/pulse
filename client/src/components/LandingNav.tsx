import { Link } from "react-router-dom"
import BrandMark from "./BrandMark"
import LoadingSpinner from "./LoadingSpinner"

const LandingNav = ({
  onStartFree,
  starting = false,
}: {
  onStartFree: () => void
  starting?: boolean
}) => (
  <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
    <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-6 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="col-start-1 row-start-1 flex items-center gap-2 justify-self-start text-lg font-bold tracking-tight text-neutral-950"
      >
        <BrandMark className="size-7" />
        Pulse
      </Link>
      <nav
        aria-label="Main navigation"
        className="col-span-2 row-start-2 flex w-full items-center justify-center gap-1 rounded-xl bg-neutral-100 p-1 text-sm font-semibold text-neutral-600 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-fit sm:justify-self-center"
      >
        <a
          href="#features"
          className="rounded-lg px-5 py-2 transition hover:bg-white hover:text-neutral-950 hover:shadow-sm"
        >
          Features
        </a>
        <a
          href="#pricing"
          className="rounded-lg px-5 py-2 transition hover:bg-white hover:text-neutral-950 hover:shadow-sm"
        >
          Pricing
        </a>
      </nav>
      <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-self-end gap-1 sm:col-start-3 sm:row-start-1 sm:gap-2">
        <Link
          to="/login"
          className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 sm:px-3 sm:text-sm"
        >
          <span className="sm:hidden">Login</span>
          <span className="hidden sm:inline">Founder login</span>
        </Link>
        <button
          type="button"
          onClick={onStartFree}
          disabled={starting}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#625BF6] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#5149e8] disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:text-sm"
        >
          {starting && <LoadingSpinner className="h-4 w-4" light />}
          {starting ? "Checking…" : "Start for free"}
        </button>
      </div>
    </div>
  </header>
)

export default LandingNav
