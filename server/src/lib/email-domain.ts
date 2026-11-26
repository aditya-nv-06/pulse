type DnsAnswer = { type: number; data: string }
type DnsResponse = { Status: number; Answer?: DnsAnswer[] }

const dnsCache = new Map<string, { valid: boolean; expiresAt: number }>()
const cacheTtlMs = 10 * 60 * 1000
const maxCacheEntries = 1_000

const queryDns = async (domain: string, type: "MX" | "A" | "AAAA") => {
  const url = new URL("https://cloudflare-dns.com/dns-query")
  url.searchParams.set("name", domain)
  url.searchParams.set("type", type)

  const response = await fetch(url, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(3_000),
  })
  if (!response.ok) {
    throw new Error(`DNS lookup failed with status ${response.status}`)
  }
  return (await response.json()) as DnsResponse
}

/** Checks that a domain accepts mail by MX, or by the RFC implicit-MX fallback. */
export const hasMailServer = async (domain: string) => {
  const cached = dnsCache.get(domain)
  if (cached && cached.expiresAt > Date.now()) return cached.valid
  if (cached) dnsCache.delete(domain)

  const mx = await queryDns(domain, "MX")
  const mxRecords = mx.Answer?.filter((answer) => answer.type === 15) ?? []
  const hasNullMx = mxRecords.some((record) => record.data.trim().endsWith(" ."))

  let valid = !hasNullMx && mx.Status === 0 && mxRecords.length > 0
  if (mx.Status === 0 && mxRecords.length === 0) {
    const [a, aaaa] = await Promise.all([queryDns(domain, "A"), queryDns(domain, "AAAA")])
    valid =
      Boolean(a.Answer?.some((answer) => answer.type === 1)) ||
      Boolean(aaaa.Answer?.some((answer) => answer.type === 28))
  }

  if (dnsCache.size >= maxCacheEntries) {
    const oldestKey = dnsCache.keys().next().value
    if (oldestKey) dnsCache.delete(oldestKey)
  }
  dnsCache.set(domain, { valid, expiresAt: Date.now() + cacheTtlMs })
  return valid
}
