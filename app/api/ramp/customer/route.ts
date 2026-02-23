import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import type { CreateCustomerInput } from '@/lib/anchors/types'

export const dynamic = 'force-dynamic'

/** POST /api/ramp/customer — create or get customer. Body: { provider, email?, country?, publicKey? } */
export async function POST(request: Request) {
  let body: Partial<CreateCustomerInput> & { provider?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const auth = await requireAuthAndAnchor(body.provider ?? null)
  if (!auth.ok) return auth.response

  const email = body.email ?? auth.email
  const country = body.country
  const publicKey = body.publicKey

  try {
    if (auth.anchor.capabilities.emailLookup && email) {
      const existing = await auth.anchor.getCustomerByEmail?.(email, country)
      if (existing)
        return NextResponse.json(existing)
    }
    const customer = await auth.anchor.createCustomer({
      email,
      country,
      publicKey,
    })
    return NextResponse.json(customer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create customer'
    console.error('[ramp/customer]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
