import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import type { BlindPayClient } from '@/lib/anchors/blindpay'

export const dynamic = 'force-dynamic'

/** GET /api/ramp/blindpay/tos-url?provider=blindpay&redirectUrl= — get BlindPay ToS URL for onboarding */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  const redirectUrl = searchParams.get('redirectUrl') ?? undefined

  const auth = await requireAuthAndAnchor(provider)
  if (!auth.ok) return auth.response

  if (auth.anchor.name !== 'blindpay')
    return NextResponse.json(
      { error: 'This endpoint is only for BlindPay' },
      { status: 400 }
    )

  try {
    const url = await (auth.anchor as BlindPayClient).generateTosUrl(redirectUrl)
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get ToS URL'
    console.error('[ramp/blindpay/tos-url]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
