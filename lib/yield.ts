/**
 * Calculates the investor yield APR based on deal term and amount.
 * Longer terms and smaller deals typically have higher rates.
 */
export function calculateYieldAPR(termDays: number, amount: number): number {
  const days = Math.max(30, Math.min(90, termDays))
  // Base APR from term: 10% at 30 days → 15% at 90 days
  const baseAPR = 10 + ((days - 30) / 60) * 5
  // Volume discount: larger deals get slightly better rates
  const discount =
    amount >= 100_000 ? 2 : amount >= 50_000 ? 1 : amount >= 20_000 ? 0.5 : 0
  return Math.round((baseAPR - discount) * 100) / 100
}

/**
 * Calculates the expected yield amount in USDC for a deal.
 */
export function calculateYieldAmount(
  amount: number,
  termDays: number,
  apr?: number
): number {
  const rate = apr ?? calculateYieldAPR(termDays, amount)
  return amount * (rate / 100) * (termDays / 365)
}
