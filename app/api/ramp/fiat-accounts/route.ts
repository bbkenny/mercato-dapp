import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import type { RegisterFiatAccountInput, FiatAccountInput } from '@/lib/anchors/types'

export const dynamic = 'force-dynamic'

/** GET /api/ramp/fiat-accounts?provider=&customerId= — list saved fiat accounts */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const auth = await requireAuthAndAnchor(searchParams.get('provider'))
  if (!auth.ok) return auth.response

  const customerId = searchParams.get('customerId')
  if (!customerId)
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 })

  try {
    const accounts = await auth.anchor.getFiatAccounts(customerId)
    return NextResponse.json(accounts)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list fiat accounts'
    console.error('[ramp/fiat-accounts]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/ramp/fiat-accounts — register a new fiat account. Body: RegisterFiatAccountInput & { provider } */
export async function POST(request: Request) {
  let body: (Partial<RegisterFiatAccountInput> & { provider?: string }) = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const auth = await requireAuthAndAnchor(body.provider ?? null)
  if (!auth.ok) return auth.response

  const { customerId, account } = body
  if (!customerId || !account)
    return NextResponse.json(
      { error: 'customerId and account are required' },
      { status: 400 }
    )

  const input: RegisterFiatAccountInput = {
    customerId,
    account: account as FiatAccountInput,
  }

  try {
    const registered = await auth.anchor.registerFiatAccount(input)
    return NextResponse.json(registered)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to register fiat account'
    console.error('[ramp/fiat-accounts]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
