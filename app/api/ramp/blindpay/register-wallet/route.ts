import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import { BlindPayClient } from '@/lib/anchors/blindpay'

export const dynamic = 'force-dynamic'

/** POST /api/ramp/blindpay/register-wallet — register Stellar wallet for a BlindPay receiver. Body: { receiverId, address, name? } */
export async function POST(request: Request) {
  const auth = await requireAuthAndAnchor('blindpay')
  if (!auth.ok) return auth.response

  if (auth.anchor.name !== 'blindpay')
    return NextResponse.json({ error: 'This endpoint is only for BlindPay' }, { status: 400 })

  let body: { receiverId?: string; address?: string; name?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { receiverId, address, name } = body
  if (!receiverId || !address)
    return NextResponse.json(
      { error: 'receiverId and address are required' },
      { status: 400 }
    )

  try {
    const wallet = await (auth.anchor as BlindPayClient).registerBlockchainWallet(
      receiverId,
      address,
      name
    )
    return NextResponse.json({
      id: wallet.id,
      receiverId,
      address,
      compositeId: `${receiverId}:${wallet.id}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to register wallet'
    console.error('[ramp/blindpay/register-wallet]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
