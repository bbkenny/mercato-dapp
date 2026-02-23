import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'

export const dynamic = 'force-dynamic'

/** GET /api/ramp/on-ramp/[id]?provider= — get on-ramp transaction status */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url)
  const auth = await requireAuthAndAnchor(searchParams.get('provider'))
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Transaction id required' }, { status: 400 })

  try {
    const tx = await auth.anchor.getOnRampTransaction(id)
    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    return NextResponse.json(tx)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get transaction'
    console.error('[ramp/on-ramp]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
