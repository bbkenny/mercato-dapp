import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import type { BlindPayClient } from '@/lib/anchors/blindpay'

export const dynamic = 'force-dynamic'

/** POST /api/ramp/blindpay/submit-payout — submit signed Stellar XDR to BlindPay. Body: { quoteId, signedTransaction, senderWalletAddress } */
export async function POST(request: Request) {
  const auth = await requireAuthAndAnchor('blindpay')
  if (!auth.ok) return auth.response

  if (auth.anchor.name !== 'blindpay')
    return NextResponse.json({ error: 'This endpoint is only for BlindPay' }, { status: 400 })

  let body: { quoteId?: string; signedTransaction?: string; senderWalletAddress?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { quoteId, signedTransaction, senderWalletAddress } = body
  if (!quoteId || !signedTransaction || !senderWalletAddress)
    return NextResponse.json(
      { error: 'quoteId, signedTransaction, and senderWalletAddress are required' },
      { status: 400 }
    )

  try {
    const payout = await (auth.anchor as BlindPayClient).submitSignedPayout(
      quoteId,
      signedTransaction,
      senderWalletAddress
    )
    return NextResponse.json(payout)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit payout'
    console.error('[ramp/blindpay/submit-payout]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
