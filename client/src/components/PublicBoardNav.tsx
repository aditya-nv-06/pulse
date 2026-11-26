import { Link, useLocation, useParams } from "react-router-dom"
import CopyBoardLink from "./CopyBoardLink"
import BrandMark from "./BrandMark"

const PublicBoardNav = () => {
  const { slug = "acme" } = useParams()
  const location = useLocation()
  const boardPath = `/board/${slug}`
  const changelogPath = `/changelog/${slug}`
  const isBoard = location.pathname.startsWith("/board")
  const isChangelog = location.pathname.startsWith("/changelog")

  return (
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
          aria-label="Public board navigation"
          className="col-span-2 row-start-2 flex w-full items-center justify-center gap-1 rounded-xl bg-neutral-100 p-1 text-xs font-semibold text-neutral-500 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-fit sm:justify-self-center sm:text-sm"
        >
          <Link
            to={boardPath}
            aria-current={isBoard ? "page" : undefined}
            className={`rounded-lg px-5 py-2 ${isBoard ? "bg-white text-neutral-950 shadow-sm" : "hover:text-neutral-950"}`}
          >
            Board
          </Link>
          <Link
            to={changelogPath}
            aria-current={isChangelog ? "page" : undefined}
            className={`rounded-lg px-5 py-2 ${isChangelog ? "bg-white text-neutral-950 shadow-sm" : "hover:text-neutral-950"}`}
          >
            Changelog
          </Link>
        </nav>
        <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-self-end gap-1 sm:col-start-3 sm:row-start-1 sm:gap-2">
          <Link
            to="/login"
            className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 sm:px-3 sm:text-sm"
          >
            <span className="sm:hidden">Login</span>
            <span className="hidden sm:inline">Founder login</span>
          </Link>
          <CopyBoardLink
            slug={slug}
            className="max-w-[34vw] rounded-xl border border-neutral-200 bg-white px-1.5 py-1 sm:max-w-[260px] sm:px-3"
          />
        </div>
      </div>
    </header>
  )
}

export default PublicBoardNav
