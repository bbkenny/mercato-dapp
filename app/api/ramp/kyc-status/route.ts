import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'

export const dynamic = 'force-dynamic'

/** GET /api/ramp/kyc-status?provider=&customerId=&publicKey= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const auth = await requireAuthAndAnchor(searchParams.get('provider'))
  if (!auth.ok) return auth.response

  const customerId = searchParams.get('customerId')
  const publicKey = searchParams.get('publicKey') ?? undefined

  if (!customerId)
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 })

  try {
    const status = await auth.anchor.getKycStatus(customerId, publicKey)
    return NextResponse.json({ kycStatus: status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get KYC status'
    console.error('[ramp/kyc-status]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
