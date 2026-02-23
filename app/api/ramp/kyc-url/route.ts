import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'

export const dynamic = 'force-dynamic'

/** GET /api/ramp/kyc-url?provider=&customerId=&publicKey=&bankAccountId= — get KYC/onboarding URL if anchor supports it */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const auth = await requireAuthAndAnchor(searchParams.get('provider'))
  if (!auth.ok) return auth.response

  if (!auth.anchor.getKycUrl)
    return NextResponse.json(
      { error: 'This ramp provider does not support a KYC URL' },
      { status: 400 }
    )

  const customerId = searchParams.get('customerId')
  const publicKey = searchParams.get('publicKey') ?? undefined
  const bankAccountId = searchParams.get('bankAccountId') ?? undefined

  if (!customerId)
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 })

  try {
    const url = await auth.anchor.getKycUrl(customerId, publicKey, bankAccountId)
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get KYC URL'
    console.error('[ramp/kyc-url]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
