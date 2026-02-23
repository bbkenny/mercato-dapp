/**
 * Anchor factory for Mercato
 *
 * Instantiates ramp providers (Etherfuse, AlfredPay, BlindPay) from environment
 * variables. All configured providers are available; the user chooses which to use
 * in the UI. Use only on the server so API keys are never exposed.
 */

import type { Anchor } from '@/lib/anchors/types'
import { EtherfuseClient } from '@/lib/anchors/etherfuse'
import { AlfredPayClient } from '@/lib/anchors/alfredpay'
import { BlindPayClient } from '@/lib/anchors/blindpay'
import { PROVIDER } from '@/lib/constants'

const PROVIDER_IDS = [PROVIDER.ETHERFUSE, PROVIDER.ALFREDPAY, PROVIDER.BLINDPAY] as const

const anchorCache = new Map<string, Anchor>()

function buildAnchor(providerId: string): Anchor | null {
  if (anchorCache.has(providerId)) return anchorCache.get(providerId) ?? null

  try {
    switch (providerId) {
      case PROVIDER.ETHERFUSE: {
        const apiKey = process.env.ETHERFUSE_API_KEY
        const baseUrl = process.env.ETHERFUSE_BASE_URL ?? 'https://api.sand.etherfuse.com'
        if (!apiKey) return null
        const client = new EtherfuseClient({ apiKey, baseUrl })
        anchorCache.set(providerId, client)
        return client
      }
      case PROVIDER.ALFREDPAY: {
        const apiKey = process.env.ALFREDPAY_API_KEY
        const apiSecret = process.env.ALFREDPAY_API_SECRET
        const baseUrl =
          process.env.ALFREDPAY_BASE_URL ??
          'https://penny-api-restricted-dev.alfredpay.io/api/v1/third-party-service/penny'
        if (!apiKey || !apiSecret) return null
        const client = new AlfredPayClient({ apiKey, apiSecret, baseUrl })
        anchorCache.set(providerId, client)
        return client
      }
      case PROVIDER.BLINDPAY: {
        const apiKey = process.env.BLINDPAY_API_KEY
        const instanceId = process.env.BLINDPAY_INSTANCE_ID
        const baseUrl = process.env.BLINDPAY_BASE_URL ?? 'https://api.blindpay.com'
        if (!apiKey || !instanceId) return null
        const client = new BlindPayClient({ apiKey, instanceId, baseUrl })
        anchorCache.set(providerId, client)
        return client
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Returns which ramp providers have all required env vars set.
 * Use this to show the user a list of available providers.
 */
export function getConfiguredProviders(): Array<{ id: string; displayName: string }> {
  const result: Array<{ id: string; displayName: string }> = []
  for (const id of PROVIDER_IDS) {
    const anchor = buildAnchor(id)
    if (anchor)
      result.push({ id: anchor.name, displayName: anchor.capabilities.displayName ?? anchor.name })
  }
  return result
}

/**
 * Returns the anchor for the given provider id, or null if that provider
 * is not configured or the id is invalid.
 */
export function getAnchorForProvider(providerId: string): Anchor | null {
  if (!providerId || typeof providerId !== 'string') return null
  const id = providerId.toLowerCase()
  return buildAnchor(id)
}

/**
 * Returns the first configured anchor, or null if none are configured.
 * Useful when a single default is needed (e.g. fallback).
 */
export function getAnchorOrNull(): Anchor | null {
  const list = getConfiguredProviders()
  if (list.length === 0) return null
  return getAnchorForProvider(list[0].id)
}

/**
 * Returns the anchor for the given provider. Use in API routes when the
 * client sends the chosen provider.
 *
 * @throws If provider is missing or not configured.
 */
export function getAnchor(providerId: string): Anchor {
  const anchor = getAnchorForProvider(providerId)
  if (anchor) return anchor
  const configured = getConfiguredProviders().map((p) => p.id).join(', ')
  throw new Error(
    configured
      ? `Unknown or unconfigured provider: "${providerId}". Available: ${configured}`
      : 'No ramp providers are configured. Set env vars for at least one provider (see env.sample).'
  )
}

/**
 * @deprecated Use getAnchorForProvider(country) or getAnchor(providerId) instead.
 */
export function getAnchorForCountry(_country: string): Anchor | null {
  return getAnchorOrNull()
}
