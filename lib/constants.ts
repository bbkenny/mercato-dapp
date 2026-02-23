/**
 * LATAM countries for supplier/PYME profile (Settings and directory).
 * Ordered for common use; display names in English.
 */
export const LATAM_COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'BR', label: 'Brazil' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'CU', label: 'Cuba' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' },
  { value: 'MX', label: 'Mexico' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'PA', label: 'Panama' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Peru' },
  { value: 'DO', label: 'Dominican Republic' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
] as const

/**
 * Industry sectors for suppliers and PYMEs (LATAM marketplace).
 */
export const SECTORS = [
  { value: 'food-manufacturing', label: 'Food Manufacturing' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'textiles-apparel', label: 'Textiles & Apparel' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'construction', label: 'Construction' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'machinery-equipment', label: 'Machinery & Equipment' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'raw-materials', label: 'Raw Materials' },
  { value: 'healthcare-pharma', label: 'Healthcare & Pharma' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'other', label: 'Other' },
] as const

export function getCountryLabel(value: string | null | undefined): string {
  if (!value) return ''
  const found = LATAM_COUNTRIES.find((c) => c.value === value)
  return found ? found.label : value
}

export function getSectorLabel(value: string | null | undefined): string {
  if (!value) return ''
  const found = SECTORS.find((s) => s.value === value)
  return found ? found.label : value
}

/**
 * Ramp integration constants
 *
 * Configure these values based on your target region and ramp provider.
 */

// Countries available in KYC and customer registration forms. Each entry maps a country code to its currency and payment rail.
export const SUPPORTED_COUNTRIES = [
  { code: 'MX', name: 'Mexico', currency: 'MXN', paymentMethod: 'SPEI' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', paymentMethod: 'COELSA' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', paymentMethod: 'PIX' },
  { code: 'CO', name: 'Colombia', currency: 'COP', paymentMethod: 'ACH' },
  { code: 'CL', name: 'Chile', currency: 'CLP', paymentMethod: 'ACH_CHL' },
  { code: 'BO', name: 'Bolivia', currency: 'BOB', paymentMethod: 'ACH_BOL' },
  { code: 'DO', name: 'Dominican Republic', currency: 'DOP', paymentMethod: 'ACH_DOM' },
  { code: 'US', name: 'United States', currency: 'USD', paymentMethod: 'BANK_USA' },
] as const;

// Default country code
export const DEFAULT_COUNTRY = 'MX';

// Provider names
export const PROVIDER = {
  ETHERFUSE: 'etherfuse',
  ALFREDPAY: 'alfredpay',
  BLINDPAY: 'blindpay',
} as const;

// KYC statuses (internal)
export const KYC_STATUS = {
  NOT_STARTED: 'not_started',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  UPDATE_REQUIRED: 'update_required',
} as const;

// Transaction statuses
export const TX_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

// AlfredPay KYC submission statuses (from API)
export const ALFREDPAY_KYC_STATUS = {
  CREATED: 'CREATED',
  IN_REVIEW: 'IN_REVIEW',
  UPDATE_REQUIRED: 'UPDATE_REQUIRED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
