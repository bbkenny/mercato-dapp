import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { NotificationType } from '@/lib/notifications'

/**
 * Create notifications for users (e.g. PyME x Investor deal events).
 * Use when DB triggers don't apply (e.g. repayment escrow created/completed).
 * Call from trusted server code; auth required.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service client bypasses RLS for insert
  const serviceSupabase = createServiceClient()

  const payload = await request.json()
  const {
    type,
    userIds,
    title,
    body: message,
    linkUrl,
    linkLabel,
    metadata,
  } = payload as {
    type: NotificationType
    userIds: string[]
    title: string
    body?: string
    linkUrl?: string
    linkLabel?: string
    metadata?: Record<string, unknown>
  }

  const appOnlyTypes: NotificationType[] = [
    'pyme_investor_deal_created',
    'pyme_investor_deal_complete',
  ]
  if (!appOnlyTypes.includes(type)) {
    return NextResponse.json(
      { error: `Type ${type} is handled by DB triggers` },
      { status: 400 }
    )
  }

  // Caller must be one of the recipients (prevents spam)
  if (!userIds.includes(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!Array.isArray(userIds) || userIds.length === 0 || !title) {
    return NextResponse.json(
      { error: 'userIds (array) and title are required' },
      { status: 400 }
    )
  }

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type,
    title,
    body: message ?? null,
    link_url: linkUrl ?? null,
    link_label: linkLabel ?? null,
    metadata: metadata ?? {},
  }))

  const { error } = await serviceSupabase.from('notifications').insert(rows)

  if (error) {
    console.error('Create notifications error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
