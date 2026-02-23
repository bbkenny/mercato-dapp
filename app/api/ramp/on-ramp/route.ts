import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import type { CreateOnRampInput } from '@/lib/anchors/types'
import { AnchorError } from '@/lib/anchors/types'

export const dynamic = 'force-dynamic'

/** POST /api/ramp/on-ramp — create on-ramp (fiat → crypto). Body: CreateOnRampInput & { provider } */
export async function POST(request: Request) {
  let body: Partial<CreateOnRampInput> & { provider?: string } = {}
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
    memo,
    bankAccountId,
  } = body

  if (!customerId || !quoteId || !stellarAddress || !fromCurrency || !toCurrency || !amount)
    return NextResponse.json(
      { error: 'customerId, quoteId, stellarAddress, fromCurrency, toCurrency, amount are required' },
      { status: 400 }
    )

  const input: CreateOnRampInput = {
    customerId,
    quoteId,
    stellarAddress,
    fromCurrency,
    toCurrency,
    amount,
    memo,
    bankAccountId,
  }

  try {
    const tx = await auth.anchor.createOnRamp(input)
    return NextResponse.json(tx)
  } catch (err) {
    if (err instanceof AnchorError && auth.anchor.name === 'etherfuse') {
      if (err.code === 'MISSING_BANK_ACCOUNT') {
        try {
          const kycUrl = await auth.anchor.getKycUrl?.(
            customerId,
            stellarAddress,
            bankAccountId
          )
          return NextResponse.json(
            {
              code: 'MISSING_BANK_ACCOUNT',
              error: err.message,
              kycUrl,
            },
            { status: 400 }
          )
        } catch (kycErr) {
          console.error('[ramp/on-ramp] Failed to get KYC URL:', kycErr)
        }
      }
      const msg = err.message.toLowerCase()
      if (msg.includes('terms and conditions') || msg.includes('terms of service')) {
        try {
          const kycUrl = await auth.anchor.getKycUrl?.(
            customerId,
            stellarAddress,
            bankAccountId
          )
          return NextResponse.json(
            {
              code: 'TERMS_NOT_COMPLETED',
              error: err.message,
              kycUrl,
            },
            { status: 400 }
          )
        } catch (kycErr) {
          console.error('[ramp/on-ramp] Failed to get KYC URL:', kycErr)
        }
      }
    }
    const message = err instanceof Error ? err.message : 'Failed to create on-ramp'
    console.error('[ramp/on-ramp]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
