import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import type { CreateOffRampInput } from '@/lib/anchors/types'

export const dynamic = 'force-dynamic'

/** POST /api/ramp/off-ramp — create off-ramp (crypto → fiat). Body: CreateOffRampInput & { provider } */
export async function POST(request: Request) {
  let body: Partial<CreateOffRampInput> & { provider?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const auth = await requireAuthAndAnchor(body.provider ?? null)
  if (!auth.ok) return auth.response

  const {
    customerId,
    quoteId,
    stellarAddress,
    fromCurrency,
    toCurrency,
    amount,
    fiatAccountId,
    memo,
  } = body

  if (
    !customerId ||
    !quoteId ||
    !stellarAddress ||
    !fromCurrency ||
    !toCurrency ||
    !amount ||
    !fiatAccountId
  )
    return NextResponse.json(
      {
        error:
          'customerId, quoteId, stellarAddress, fromCurrency, toCurrency, amount, fiatAccountId are required',
      },
      { status: 400 }
    )

  const input: CreateOffRampInput = {
    customerId,
    quoteId,
    stellarAddress,
    fromCurrency,
    toCurrency,
    amount,
    fiatAccountId,
    memo,
  }

  try {
    const tx = await auth.anchor.createOffRamp(input)
    return NextResponse.json(tx)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create off-ramp'
    console.error('[ramp/off-ramp]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
