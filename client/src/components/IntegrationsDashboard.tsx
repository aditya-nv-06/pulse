import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api, ApiError, type Workspace } from "../api"
import FounderNav from "./FounderNav"
import LoadingState from "./LoadingState"

const IntegrationsDashboard = () => {
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [sheetsEnabled, setSheetsEnabled] = useState(false)
  const [sheetsWebhookUrl, setSheetsWebhookUrl] = useState("")
  const [sheetsSaving, setSheetsSaving] = useState(false)
  const [sheetsMessage, setSheetsMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const activeWorkspace = useRef<string | null>(null)

  const loadWorkspace = async (selected: Workspace) => {
    activeWorkspace.current = selected.slug
    setLoading(true)
    setError("")
    setWorkspace(selected)
    setSheetsEnabled(false)
    setSheetsWebhookUrl("")
    setSheetsMessage("")
    setSheetsSaving(false)
    try {
      const settings = await api.getGoogleSheetsSettings(selected.slug)
      if (activeWorkspace.current !== selected.slug) return
      setSheetsEnabled(settings.enabled)
      setSheetsWebhookUrl(settings.webhookUrl)
    } finally {
      if (activeWorkspace.current === selected.slug) setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      api
        .getWorkspaces()
        .then(async (items) => {
          setWorkspaces(items)
          if (items[0]) await loadWorkspace(items[0])
          else {
            setError("No workspace is available for this account.")
            setLoading(false)
          }
        })
        .catch((loadError) => {
          if (loadError instanceof ApiError && loadError.message === "Session expired")
            navigate("/login")
          else
            setError(loadError instanceof Error ? loadError.message : "Unable to load integrations")
          setLoading(false)
        })
    })
  }, [navigate])

  const switchWorkspace = (slug: string) => {
    const selected = workspaces.find((item) => item.slug === slug)
    if (selected)
      void loadWorkspace(selected).catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load integrations"),
      )
  }

  const saveSheetsSettings = async (enabled = sheetsEnabled) => {
    if (!workspace) return
    const previousEnabled = sheetsEnabled
    const slug = workspace.slug
    setSheetsSaving(true)
    setSheetsEnabled(enabled)
    setSheetsMessage("Saving webhook settings…")
    try {
      const settings = await api.updateGoogleSheetsSettings(slug, {
        enabled,
        webhookUrl: sheetsWebhookUrl.trim(),
      })
      if (activeWorkspace.current !== slug) return
      setSheetsEnabled(settings.enabled)
      setSheetsWebhookUrl(settings.webhookUrl)
      setSheetsMessage(
        settings.enabled ? "Google Sheets sync is on." : "Webhook saved. Sync is off.",
      )
    } catch (saveError) {
      if (activeWorkspace.current !== slug) return
      setSheetsEnabled(previousEnabled)
      setSheetsMessage(
        saveError instanceof Error ? saveError.message : "Unable to update Google Sheets settings",
      )
    } finally {
      if (activeWorkspace.current === slug) setSheetsSaving(false)
    }
  }

  const toggleSheets = async () => {
    if (sheetsSaving) return
    if (!sheetsEnabled && !sheetsWebhookUrl.trim()) {
      setSheetsMessage("Add a Google Apps Script webhook URL before turning sync on.")
      return
    }
    await saveSheetsSettings(!sheetsEnabled)
  }

  if (loading) return <LoadingState label="Loading integrations…" />

  if (!workspace)
    return (
      <main className="grid min-h-screen place-items-center bg-[#FAFAF8] px-6">
        <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p role="alert" className="font-semibold">
            {error}
          </p>
        </div>
      </main>
    )

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-neutral-950">
      <FounderNav
        workspace={workspace}
        workspaces={workspaces}
        onWorkspaceChange={switchWorkspace}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:ml-64">
        <div className="mb-8">
          <p className="text-sm font-bold text-[#625BF6]">
            {workspace.name.toUpperCase()} / INTEGRATIONS
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Integrations</h1>
          <p className="mt-2 text-neutral-500">Connect your workspace to the tools you use.</p>
        </div>
        {error && (
          <p role="alert" className="mb-5 text-sm text-red-600">
            {error}
          </p>
        )}
        <section className="mt-8 grid gap-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)] md:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#625BF6]">
              Integrations
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Google Sheets</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
              Send every new public feature request to a spreadsheet. Add a Google Apps Script web
              app URL, then switch sync on or off whenever you need.
            </p>
            <a
              href="https://developers.google.com/apps-script/guides/web"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-sm font-semibold text-[#625BF6] hover:underline"
            >
              Set up an Apps Script webhook ↗
            </a>
          </div>
          <div className="rounded-2xl bg-[#FAFAF8] p-4 sm:p-5">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void saveSheetsSettings()
              }}
            >
              <label htmlFor="google-sheets-webhook" className="text-sm font-semibold">
                Webhook URL
              </label>
              <input
                id="google-sheets-webhook"
                type="url"
                value={sheetsWebhookUrl}
                onChange={(event) => setSheetsWebhookUrl(event.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#625BF6]"
              />
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                Deploy your script as a web app that can receive requests, then paste its production
                URL ending in <code>/exec</code>.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Sync new feature requests</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {sheetsEnabled ? "Enabled for this workspace" : "Currently off"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sheetsEnabled}
                  aria-busy={sheetsSaving}
                  aria-label="Toggle Google Sheets sync"
                  onClick={() => void toggleSheets()}
                  disabled={sheetsSaving}
                  className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#625BF6] disabled:cursor-wait disabled:opacity-60 ${sheetsEnabled ? "bg-[#625BF6]" : "bg-neutral-300"}`}
                >
                  <span
                    className={`size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${sheetsEnabled ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
              <button
                disabled={sheetsSaving}
                className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
              >
                {sheetsSaving ? "Saving…" : "Save webhook"}
              </button>
              {sheetsMessage && (
                <p role="status" className="mt-3 text-sm text-neutral-600">
                  {sheetsMessage}
                </p>
              )}
            </form>
            <details className="mt-4 border-t border-neutral-200 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-600">
                See the webhook payload
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-[#171717] p-3 text-[11px] leading-5 text-[#FAFAF8]">{`{
  "event": "feature.created",
  "workspace": { "name": "...", "slug": "..." },
  "feature": { "title": "...", "description": "...", "author": "...", "status": "OPEN" }
}`}</pre>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Your Apps Script should read <code>JSON.parse(e.postData.contents)</code> in{" "}
                <code>doPost(e)</code> and append the feature fields to your sheet.
              </p>
            </details>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-600">
                Example Apps Script receiver
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-[#171717] p-3 text-[11px] leading-5 text-[#FAFAF8]">{`function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName("Feature requests")
    || spreadsheet.insertSheet("Feature requests");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Workspace", "Feature", "Description", "Author", "Status", "Created"]);
  }
  sheet.appendRow([
    data.workspace.name,
    data.feature.title,
    data.feature.description,
    data.feature.author,
    data.feature.status,
    data.feature.createdAt
  ]);
  return ContentService.createTextOutput("ok");
}`}</pre>
            </details>
          </div>
        </section>
      </main>
    </div>
  )
}

export default IntegrationsDashboard
