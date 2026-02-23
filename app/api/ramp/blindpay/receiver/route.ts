import { NextResponse } from 'next/server'
import { requireAuthAndAnchor } from '@/lib/ramp-api'
import type { BlindPayClient } from '@/lib/anchors/blindpay'
import type { BlindPayCreateReceiverRequest } from '@/lib/anchors/blindpay/types'

export const dynamic = 'force-dynamic'

/** POST /api/ramp/blindpay/receiver — create BlindPay receiver (customer + KYC). Body: BlindPayCreateReceiverRequest */
export async function POST(request: NextRequest) {
  const auth = await requireAuthAndAnchor('blindpay')
  if (!auth.ok) return auth.response

  if (auth.anchor.name !== 'blindpay')
    return NextResponse.json({ error: 'This endpoint is only for BlindPay' }, { status: 400 })

  let body: Partial<BlindPayCreateReceiverRequest> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    tos_id,
    type,
    kyc_type,
    email,
    tax_id,
    address_line_1,
    city,
    state_province_region,
    country,
    postal_code,
    ip_address,
    phone_number,
    first_name,
    last_name,
    date_of_birth,
  } = body

  if (
    !tos_id ||
    !type ||
    !kyc_type ||
    !email ||
    !tax_id ||
    !address_line_1 ||
    !city ||
    !state_province_region ||
    !country ||
    !postal_code ||
    !ip_address ||
    !phone_number
  )
    return NextResponse.json(
      {
        error:
          'tos_id, type, kyc_type, email, tax_id, address_line_1, city, state_province_region, country, postal_code, ip_address, phone_number are required',
      },
      { status: 400 }
    )

  const payload: BlindPayCreateReceiverRequest = {
    tos_id,
    type: type as 'individual' | 'business',
    kyc_type: kyc_type as 'standard' | 'enhanced',
    email,
    tax_id,
    address_line_1,
    city,
    state_province_region,
    country,
    postal_code,
    ip_address,
    phone_number,
    first_name,
    last_name,
    date_of_birth,
    address_line_2: body.address_line_2,
  }

  try {
    const receiver = await (auth.anchor as BlindPayClient).createReceiver(payload)
    return NextResponse.json({
      id: receiver.id,
      email: receiver.email,
      kycStatus: receiver.kyc_status,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create receiver'
    console.error('[ramp/blindpay/receiver]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
