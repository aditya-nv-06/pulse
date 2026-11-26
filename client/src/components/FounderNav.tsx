import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { api, type Workspace } from "../api"
import CopyBoardLink from "./CopyBoardLink"
import BrandMark from "./BrandMark"

type FounderNavProps = {
  workspace: Workspace
  workspaces: Workspace[]
  onWorkspaceChange: (slug: string) => void
}

const FounderNav = ({ workspace, workspaces, onWorkspaceChange }: FounderNavProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState("")
  const isChangelog = location.pathname.includes("changelog")
  const isBlueprint = location.pathname.includes("blueprint")
  const isIntegrations = location.pathname.includes("integrations")
  const isMeetings = location.pathname.includes("meetings")
  const isAnalytics = location.pathname.includes("analytics")
  const isPosts = location.pathname.includes("/dashboard/posts")

  const signOut = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError("")
    try {
      await api.logout()
      navigate("/login", { replace: true })
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to log out")
    } finally {
      setLoggingOut(false)
    }
  }

  const navLinkClass = (active: boolean) =>
    `rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${active ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-950"}`
  const sidebarLinkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${active ? "bg-[#625BF6]/10 text-[#625BF6]" : "text-neutral-500 hover:bg-neutral-100"}`

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex h-20 shrink-0 items-center border-b border-neutral-100 px-6">
          <Link
            to="/dashboard/posts"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-neutral-950"
          >
            <BrandMark className="size-7" />
            Pulse
          </Link>
        </div>
        <div className="flex-1 space-y-7 overflow-y-auto p-5">
          <div>
            <label
              className="px-2 text-[10px] font-bold uppercase tracking-[.16em] text-neutral-400"
              htmlFor="founder-workspace-switcher"
            >
              Workspace
            </label>
            <select
              id="founder-workspace-switcher"
              value={workspace.slug}
              onChange={(event) => onWorkspaceChange(event.target.value)}
              className="mt-3 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#625BF6]"
            >
              {workspaces.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <nav aria-label="Founder navigation" className="space-y-1">
            <Link
              to="/dashboard/posts"
              aria-current={isPosts && !isChangelog ? "page" : undefined}
              className={sidebarLinkClass(isPosts && !isChangelog)}
            >
              <span aria-hidden="true">▤</span>Features
            </Link>
            <Link
              to="/dashboard/changelog"
              aria-current={isChangelog ? "page" : undefined}
              className={sidebarLinkClass(isChangelog)}
            >
              <span aria-hidden="true">✦</span>Changelog
            </Link>
            <Link
              to="/dashboard/blueprint"
              aria-current={isBlueprint ? "page" : undefined}
              className={sidebarLinkClass(isBlueprint)}
            >
              <span aria-hidden="true">◇</span>Architecture
            </Link>
            <Link
              to="/dashboard/integrations"
              aria-current={isIntegrations ? "page" : undefined}
              className={sidebarLinkClass(isIntegrations)}
            >
              <span aria-hidden="true">⌘</span>Integrations
            </Link>
            <Link
              to="/dashboard/meetings"
              aria-current={isMeetings ? "page" : undefined}
              className={sidebarLinkClass(isMeetings)}
            >
              <span aria-hidden="true">◷</span>Meeting requests
            </Link>
            <Link
              to="/dashboard/analytics"
              aria-current={isAnalytics ? "page" : undefined}
              className={sidebarLinkClass(isAnalytics)}
            >
              <span aria-hidden="true">▥</span>Analytics
            </Link>
          </nav>
          <section
            className="rounded-2xl border border-neutral-200 bg-[#FAFAF8] p-3"
            aria-label="Public board link"
          >
            <p className="mb-2 px-1 text-xs font-semibold text-neutral-500">Public board</p>
            <CopyBoardLink slug={workspace.slug} className="w-full" />
          </section>
        </div>
        <div className="shrink-0 border-t border-neutral-100 p-5">
          {logoutError && (
            <p role="alert" className="mb-2 text-xs text-red-600">
              {logoutError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={loggingOut}
            className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-neutral-500 hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur lg:pl-64">
        <div className="mx-auto grid min-h-16 max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8">
          <Link
            to="/dashboard/posts"
            className="col-start-1 row-start-1 flex items-center gap-2 text-lg font-bold tracking-tight text-neutral-950 lg:hidden"
          >
            <BrandMark className="size-7" />
            Pulse
          </Link>

          <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-self-end gap-2 lg:col-start-2">
            <CopyBoardLink
              slug={workspace.slug}
              className="max-w-[23vw] rounded-xl border border-neutral-200 bg-white px-1.5 py-1 sm:max-w-[260px] sm:px-3"
            />
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={loggingOut}
              className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-50 sm:px-3 sm:text-sm lg:hidden"
            >
              {loggingOut ? "Signing out…" : "Log out"}
            </button>
          </div>

          <div className="col-span-2 row-start-2 lg:hidden">
            <label htmlFor="founder-workspace-switcher-mobile" className="sr-only">
              Switch workspace
            </label>
            <select
              id="founder-workspace-switcher-mobile"
              value={workspace.slug}
              onChange={(event) => onWorkspaceChange(event.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#625BF6]"
            >
              {workspaces.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <nav
            aria-label="Founder navigation"
            className="col-span-2 row-start-3 flex w-full items-center justify-start gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1 lg:hidden"
          >
            <Link
              to="/dashboard/posts"
              aria-current={isPosts && !isChangelog ? "page" : undefined}
              className={navLinkClass(isPosts && !isChangelog)}
            >
              Features
            </Link>
            <Link
              to="/dashboard/changelog"
              aria-current={isChangelog ? "page" : undefined}
              className={navLinkClass(isChangelog)}
            >
              Changelog
            </Link>
            <Link
              to="/dashboard/blueprint"
              aria-current={isBlueprint ? "page" : undefined}
              className={navLinkClass(isBlueprint)}
            >
              Architecture
            </Link>
            <Link
              to="/dashboard/integrations"
              aria-current={isIntegrations ? "page" : undefined}
              className={navLinkClass(isIntegrations)}
            >
              Integrations
            </Link>
            <Link
              to="/dashboard/meetings"
              aria-current={isMeetings ? "page" : undefined}
              className={navLinkClass(isMeetings)}
            >
              Meeting requests
            </Link>
            <Link
              to="/dashboard/analytics"
              aria-current={isAnalytics ? "page" : undefined}
              className={navLinkClass(isAnalytics)}
            >
              Analytics
            </Link>
          </nav>

          {logoutError && (
            <p
              role="alert"
              className="col-span-2 row-start-4 text-right text-xs text-red-600 lg:hidden"
            >
              {logoutError}
            </p>
          )}
        </div>
      </header>
    </>
  )
}

export default FounderNav
