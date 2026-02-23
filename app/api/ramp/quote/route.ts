import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import type { GetQuoteInput } from '@/lib/anchors/types'
import { AnchorError } from '@/lib/anchors/types'

const FIAT_CURRENCIES = ['MXN', 'USD', 'BRL', 'ARS', 'COP']

export const dynamic = 'force-dynamic'

/** GET /api/ramp/quote?provider=&fromCurrency=&toCurrency=&fromAmount=&toAmount=&customerId=&stellarAddress= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  const auth = await requireAuthAndAnchor(provider)
  if (!auth.ok) return auth.response

  const fromCurrency = searchParams.get('fromCurrency')
  const toCurrency = searchParams.get('toCurrency')
  const fromAmount = searchParams.get('fromAmount')
  const toAmount = searchParams.get('toAmount')
  const customerId = searchParams.get('customerId') ?? undefined
  const stellarAddress = searchParams.get('stellarAddress') ?? undefined

  if (!fromCurrency || !toCurrency)
    return NextResponse.json(
      { error: 'fromCurrency and toCurrency are required' },
      { status: 400 }
    )
  if (!fromAmount && !toAmount)
    return NextResponse.json(
      { error: 'fromAmount or toAmount is required' },
      { status: 400 }
    )

  const isOnRamp = FIAT_CURRENCIES.includes(fromCurrency.toUpperCase())
  const needsBlockchainWallet = auth.anchor.name === 'blindpay' && isOnRamp
  const hasValidCompositeId =
    customerId?.includes(':') && (customerId.split(':')[1]?.length ?? 0) >= 15

  if (needsBlockchainWallet && !hasValidCompositeId) {
    try {
      const tosUrl = await auth.anchor.getKycUrl?.('setup', undefined, undefined)
      return NextResponse.json(
        {
          code: 'BLINDPAY_SETUP_REQUIRED',
          error:
            'BlindPay requires onboarding before getting quotes: accept Terms of Service, complete KYC, and register your Stellar wallet. Start by accepting the Terms below.',
          tosUrl,
        },
        { status: 400 }
      )
    } catch {
      return NextResponse.json(
        {
          code: 'BLINDPAY_SETUP_REQUIRED',
          error:
            'BlindPay requires onboarding first. Please accept Terms of Service and complete KYC before adding funds.',
        },
        { status: 400 }
      )
    }
  }

  const input: GetQuoteInput = {
    fromCurrency,
    toCurrency,
    fromAmount: fromAmount ?? undefined,
    toAmount: toAmount ?? undefined,
    customerId,
    stellarAddress,
  }

  try {
    const quote = await auth.anchor.getQuote(input)
    return NextResponse.json(quote)
  } catch (err) {
    if (err instanceof AnchorError && auth.anchor.name === 'blindpay') {
      const msg = String(err.message)
      if (msg.includes('blockchain_wallet_id') || msg.includes('15 character')) {
        try {
          const tosUrl = await auth.anchor.getKycUrl?.('setup', undefined, undefined)
          return NextResponse.json(
            {
              code: 'BLINDPAY_SETUP_REQUIRED',
              error:
                'BlindPay requires onboarding: accept Terms of Service, complete KYC, and register your Stellar wallet first.',
              tosUrl,
            },
            { status: 400 }
          )
        } catch {
          // fall through to generic error
        }
      }
    }
    const message = err instanceof Error ? err.message : 'Failed to get quote'
    console.error('[ramp/quote]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
