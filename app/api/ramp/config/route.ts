import { NextResponse } from 'next/server'
import { getConfiguredProviders, getAnchorForProvider } from '@/lib/anchor-factory'
import { requireAuth } from '@/lib/ramp-api'

export const dynamic = 'force-dynamic'

/** GET /api/ramp/config — returns which ramp providers are available (for user to choose). */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const providers = getConfiguredProviders()
  const withCapabilities = providers.map((p) => {
    const anchor = getAnchorForProvider(p.id)
    return {
      id: p.id,
      displayName: p.displayName,
      capabilities: anchor?.capabilities ?? null,
    }
  })

  return NextResponse.json({
    enabled: withCapabilities.length > 0,
    providers: withCapabilities,
  })
}
