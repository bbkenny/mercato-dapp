'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWallet } from '@/hooks/use-wallet'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { submitSignedTransaction } from '@/lib/stellar-submit'
import { SUPPORTED_COUNTRIES, DEFAULT_COUNTRY } from '@/lib/constants'
import { ArrowLeft, Wallet, ArrowDownToLine, ArrowUpFromLine, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

type RampProviderOption = {
  id: string
  displayName: string
  capabilities: Record<string, unknown> | null
}

type RampConfig = {
  enabled: boolean
  providers: RampProviderOption[]
}

type Customer = { id: string; email: string; kycStatus: string; bankAccountId?: string }
type Quote = { id: string; fromAmount: string; toAmount: string; fromCurrency: string; toCurrency: string; exchangeRate: string; fee: string; expiresAt: string }
type OnRampTx = { id: string; status: string; paymentInstructions?: { type: string; clabe?: string; reference?: string }; interactiveUrl?: string }
type FiatAccount = { id: string; type: string; accountNumber: string; bankName: string; accountHolderName: string }

export default function RampPage() {
  const { walletInfo, isConnected, handleConnect } = useWallet()
  const [config, setConfig] = useState<RampConfig | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [customerByProvider, setCustomerByProvider] = useState<Record<string, Customer>>({})
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'idle' | 'customer' | 'quote' | 'onramp' | 'offramp'>('idle')

  // On-ramp state
  const [onCountry, setOnCountry] = useState(DEFAULT_COUNTRY)
  const [onAmount, setOnAmount] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [onRampTx, setOnRampTx] = useState<OnRampTx | null>(null)

  // Off-ramp state
  const [fiatAccounts, setFiatAccounts] = useState<FiatAccount[]>([])
  const [offAmount, setOffAmount] = useState('')
  const [offFiatAccountId, setOffFiatAccountId] = useState('')
  const [offRampTx, setOffRampTx] = useState<{ id: string; status: string; signableTransaction?: string; interactiveUrl?: string } | null>(null)
  const [isSigningOffRamp, setIsSigningOffRamp] = useState(false)
  const [newBankClabe, setNewBankClabe] = useState('')
  const [newBankBeneficiary, setNewBankBeneficiary] = useState('')
  const [newBankName, setNewBankName] = useState('')
  const [addingFiatAccount, setAddingFiatAccount] = useState(false)
  const [onboardingPrompt, setOnboardingPrompt] = useState<{
    code: string
    message: string
    kycUrl?: string
    tosUrl?: string
  } | null>(null)

  const searchParams = useSearchParams()
  const fromCurrency = SUPPORTED_COUNTRIES.find((c) => c.code === onCountry)?.currency ?? 'MXN'
  const toCurrency = 'USDC'

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/ramp/config')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load config')
        if (!cancelled) {
          setConfig(data)
          if (data.enabled && data.providers?.length > 0)
            setSelectedProvider((prev) => prev || data.providers[0].id)
        }
      } catch (e) {
        if (!cancelled) setConfig({ enabled: false, providers: [] })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Restore BlindPay customer after setup redirect
  useEffect(() => {
    const composite = searchParams.get('blindpay_setup')
    const email = searchParams.get('blindpay_email')
    if (composite && selectedProvider === 'blindpay') {
      setCustomerByProvider((prev) => ({
        ...prev,
        blindpay: { id: composite, email: email || '', kycStatus: 'approved' },
      }))
      window.history.replaceState({}, '', '/dashboard/ramp')
    }
  }, [searchParams, selectedProvider])

  const customer = selectedProvider ? customerByProvider[selectedProvider] ?? null : null

  const ensureCustomer = async () => {
    if (!selectedProvider) {
      toast.error('Select a ramp provider first')
      throw new Error('No provider selected')
    }
    if (customer) return customer
    setAction('customer')
    try {
      const res = await fetch('/api/ramp/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          country: onCountry,
          publicKey: walletInfo?.address,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create customer')
      setCustomerByProvider((prev) => ({ ...prev, [selectedProvider]: data as Customer }))
      return data as Customer
    } finally {
      setAction('idle')
    }
  }

  const fetchQuote = async (from: string, to: string, amount: string, customerId?: string) => {
    if (!selectedProvider) throw new Error('Select a ramp provider first')
    const params = new URLSearchParams({
      provider: selectedProvider,
      fromCurrency: from,
      toCurrency: to,
      fromAmount: amount,
      ...(customerId && { customerId }),
      ...(walletInfo?.address && { stellarAddress: walletInfo.address }),
    })
    const res = await fetch(`/api/ramp/quote?${params}`)
    const data = await res.json()
    if (!res.ok) {
      if (data.code === 'BLINDPAY_SETUP_REQUIRED') {
        setOnboardingPrompt({
          code: data.code,
          message: data.error || 'BlindPay requires onboarding first.',
          tosUrl: data.tosUrl,
        })
      }
      throw new Error(data.error || 'Failed to get quote')
    }
    return data as Quote
  }

  const handleOnRampQuote = async () => {
    if (!onAmount || Number(onAmount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setOnboardingPrompt(null)
    setAction('quote')
    try {
      const c = await ensureCustomer()
      const q = await fetchQuote(fromCurrency, toCurrency, onAmount, c.id)
      setQuote(q)
      toast.success('Quote ready')
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      toast.error(err.message)
    } finally {
      setAction('idle')
    }
  }

  const handleStartOnRamp = async () => {
    if (!quote || !walletInfo?.address) {
      toast.error('Get a quote first and connect your wallet')
      return
    }
    if (!customer) {
      toast.error('Customer not loaded. Get a quote first.')
      return
    }
    setAction('onramp')
    try {
      const res = await fetch('/api/ramp/on-ramp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          customerId: customer.id,
          quoteId: quote.id,
          stellarAddress: walletInfo.address,
          fromCurrency: quote.fromCurrency,
          toCurrency: quote.toCurrency,
          amount: quote.fromAmount,
          bankAccountId: customer?.bankAccountId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if ((data.code === 'TERMS_NOT_COMPLETED' || data.code === 'MISSING_BANK_ACCOUNT') && data.kycUrl) {
          setOnboardingPrompt({
            code: data.code,
            message: data.error || 'Complete onboarding before creating an order.',
            kycUrl: data.kycUrl,
          })
          return
        }
        throw new Error(data.error || 'Failed to start on-ramp')
      }
      setOnRampTx(data)
      toast.success('On-ramp started')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start on-ramp')
    } finally {
      setAction('idle')
    }
  }

  const fiatAccountCustomerId = (c: Customer) =>
    selectedProvider === 'blindpay' && c.id.includes(':') ? (c.id.split(':')[0] ?? c.id) : c.id

  const loadFiatAccounts = async () => {
    if (!selectedProvider) {
      toast.error('Select a ramp provider first')
      return
    }
    const c = customer ?? (await ensureCustomer())
    const effectiveId = fiatAccountCustomerId(c)
    const res = await fetch(
      `/api/ramp/fiat-accounts?provider=${encodeURIComponent(selectedProvider ?? '')}&customerId=${encodeURIComponent(effectiveId)}`
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load accounts')
    setFiatAccounts(Array.isArray(data) ? data : [])
  }

  const handleAddFiatAccount = async () => {
    if (!selectedProvider || !newBankClabe.trim() || !newBankBeneficiary.trim()) {
      toast.error('Enter CLABE and beneficiary name')
      return
    }
    const c = customer ?? (await ensureCustomer())
    const effectiveId = fiatAccountCustomerId(c)
    setAddingFiatAccount(true)
    try {
      const res = await fetch('/api/ramp/fiat-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          customerId: effectiveId,
          account: { type: 'spei', clabe: newBankClabe.trim(), beneficiary: newBankBeneficiary.trim(), bankName: newBankName.trim() || undefined },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add bank account')
      setNewBankClabe('')
      setNewBankBeneficiary('')
      setNewBankName('')
      await loadFiatAccounts()
      toast.success('Bank account added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add bank account')
    } finally {
      setAddingFiatAccount(false)
    }
  }

  const handleOffRampQuote = async () => {
    if (!selectedProvider) {
      toast.error('Select a ramp provider first')
      return
    }
    if (!offAmount || Number(offAmount) <= 0 || !offFiatAccountId) {
      toast.error('Enter amount and select a fiat account')
      return
    }
    setAction('quote')
    try {
      const c = await ensureCustomer()
      const quoteCustomerId =
        selectedProvider === 'blindpay' && c.id.includes(':')
          ? `${c.id.split(':')[0]}:${offFiatAccountId}`
          : c.id
      const q = await fetchQuote(toCurrency, fromCurrency, offAmount, quoteCustomerId)
      setQuote(q)
      toast.success('Quote ready')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to get quote')
    } finally {
      setAction('idle')
    }
  }

  const handleStartOffRamp = async () => {
    if (!quote || !walletInfo?.address || !offFiatAccountId) {
      toast.error('Get a quote, connect wallet, and select a fiat account')
      return
    }
    if (!customer) {
      toast.error('Customer not loaded. Get a quote first.')
      return
    }
    const offRampCustomerId =
      selectedProvider === 'blindpay' && customer.id.includes(':')
        ? `${customer.id.split(':')[0]}:${offFiatAccountId}`
        : customer.id
    setAction('offramp')
    try {
      const res = await fetch('/api/ramp/off-ramp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          customerId: offRampCustomerId,
          quoteId: quote.id,
          stellarAddress: walletInfo.address,
          fromCurrency: quote.fromCurrency,
          toCurrency: quote.toCurrency,
          amount: quote.fromAmount,
          fiatAccountId: offFiatAccountId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start off-ramp')
      setOffRampTx(data)
      toast.success('Off-ramp started. Sign the transaction to complete.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start off-ramp')
    } finally {
      setAction('idle')
    }
  }

  const providerCapabilities = config?.providers?.find((p) => p.id === selectedProvider)?.capabilities as Record<string, boolean> | undefined
  const deferredSigning = providerCapabilities?.deferredOffRampSigning === true
  const submitToAnchor = providerCapabilities?.requiresAnchorPayoutSubmission === true

  useEffect(() => {
    if (!offRampTx?.id || offRampTx.signableTransaction || !selectedProvider || !deferredSigning) return
    let cancelled = false
    const interval = setInterval(async () => {
      if (cancelled) return
      try {
        const res = await fetch(
          `/api/ramp/off-ramp/${offRampTx.id}?provider=${encodeURIComponent(selectedProvider)}`
        )
        const data = await res.json()
        if (res.ok && data.signableTransaction) {
          setOffRampTx((prev) => (prev ? { ...prev, signableTransaction: data.signableTransaction } : null))
          toast.success('Transaction ready to sign')
        }
      } catch {
        // ignore
      }
    }, 2500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [offRampTx?.id, offRampTx?.signableTransaction, selectedProvider, deferredSigning])

  const handleSignAndSubmitOffRamp = async () => {
    if (!offRampTx?.signableTransaction || !walletInfo?.address) {
      toast.error('Connect wallet and wait for the transaction to be ready')
      return
    }
    const payoutQuoteId = quote?.id ?? offRampTx.id
    if (submitToAnchor && !payoutQuoteId) {
      toast.error('Quote not found. Please start a new cash out.')
      return
    }
    setIsSigningOffRamp(true)
    try {
      const signedXdr = await signTransaction({
        unsignedTransaction: offRampTx.signableTransaction,
        address: walletInfo.address,
      })
      if (submitToAnchor) {
        const res = await fetch('/api/ramp/blindpay/submit-payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId: payoutQuoteId,
            signedTransaction: signedXdr,
            senderWalletAddress: walletInfo.address,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to submit payout')
        setOffRampTx((prev) => (prev ? { ...prev, status: data.status ?? 'processing' } : null))
        toast.success('Payout submitted. Fiat will be sent to your bank account.')
      } else {
        await submitSignedTransaction(signedXdr)
        setOffRampTx((prev) => (prev ? { ...prev, status: 'processing' } : null))
        toast.success('Transaction submitted. Fiat will be sent to your bank account.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign or submit')
    } finally {
      setIsSigningOffRamp(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </div>
    )
  }

  if (!config?.enabled) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <Card className="mt-6 max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Add funds / Cash out
              </CardTitle>
              <CardDescription>
                No ramp providers are configured. Set env vars for at least one provider (Etherfuse, AlfredPay, BlindPay) in your environment. See env.sample.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="mt-6 flex items-center gap-2">
          <Wallet className="h-5 w-5" aria-hidden />
          <h1 className="text-2xl font-bold">Add funds & Cash out</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Convert between local currency and USDC on Stellar. Choose your preferred provider below.
        </p>

        {config.providers.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ramp provider</CardTitle>
              <CardDescription>
                All configured providers are available. Pick the one you want to use for this session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedProvider ?? ''}
                onValueChange={(id) => {
                  setSelectedProvider(id)
                  setQuote(null)
                  setOnRampTx(null)
                  setOffRampTx(null)
                }}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {config.providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {!isConnected && (
          <Card className="mt-6 border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <p className="text-sm">Connect your Stellar wallet to add funds or cash out.</p>
              <Button onClick={handleConnect}>Connect wallet</Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="on-ramp" className="mt-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="on-ramp" className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Add funds
            </TabsTrigger>
            <TabsTrigger value="off-ramp" className="gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              Cash out
            </TabsTrigger>
          </TabsList>
          <TabsContent value="on-ramp" className="mt-6">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Add funds (fiat → USDC)</CardTitle>
                <CardDescription>
                  Enter amount in local currency. You’ll get a quote and payment instructions (e.g. SPEI) to complete the transfer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {onboardingPrompt && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
                    <p className="font-medium text-amber-800 dark:text-amber-200">{onboardingPrompt.message}</p>
                    {onboardingPrompt.kycUrl && (
                      <Button asChild size="sm">
                        <a href={onboardingPrompt.kycUrl} target="_blank" rel="noopener noreferrer">
                          Complete onboarding <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {onboardingPrompt.tosUrl && !onboardingPrompt.kycUrl && (
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <a href={onboardingPrompt.tosUrl} target="_blank" rel="noopener noreferrer">
                            Accept Terms of Service <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href="/dashboard/ramp/blindpay-setup">Complete full BlindPay setup</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Country</Label>
                  <Select value={onCountry} onValueChange={setOnCountry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Amount ({fromCurrency})</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 1000"
                    value={onAmount}
                    onChange={(e) => setOnAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleOnRampQuote}
                    disabled={action !== 'idle' || !isConnected || !selectedProvider}
                  >
                    {action === 'quote' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Get quote
                  </Button>
                  {quote && (
                    <Button
                      variant="secondary"
                      onClick={handleStartOnRamp}
                      disabled={action !== 'idle'}
                    >
                      {action === 'onramp' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Start on-ramp
                    </Button>
                  )}
                </div>
                {quote && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p>You send {quote.fromAmount} {quote.fromCurrency} → receive ~{quote.toAmount} {quote.toCurrency}</p>
                    <p className="text-muted-foreground">Rate: {quote.exchangeRate} · Fee: {quote.fee}</p>
                  </div>
                )}
                {onRampTx && (
                  <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-2">
                    <p className="font-medium">Payment instructions</p>
                    {onRampTx.interactiveUrl ? (
                      <Button asChild size="sm">
                        <a href={onRampTx.interactiveUrl} target="_blank" rel="noopener noreferrer">
                          Complete in {config.providers.find((p) => p.id === selectedProvider)?.displayName ?? selectedProvider} <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ) : onRampTx.paymentInstructions?.type === 'spei' && onRampTx.paymentInstructions?.clabe ? (
                      <>
                        <p className="text-sm">CLABE: <code className="bg-muted px-1 rounded">{onRampTx.paymentInstructions.clabe}</code></p>
                        {onRampTx.paymentInstructions.reference && (
                          <p className="text-sm">Reference: <code className="bg-muted px-1 rounded">{onRampTx.paymentInstructions.reference}</code></p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm">Check your email or complete the flow in the provider’s window.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="off-ramp" className="mt-6">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Cash out (USDC → fiat)</CardTitle>
                <CardDescription>
                  Withdraw USDC to your registered bank account. Add a fiat account below if needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" size="sm" onClick={loadFiatAccounts}>
                  Load my bank accounts
                </Button>
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Add bank account (SPEI)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="new-clabe">CLABE (18 digits)</Label>
                      <Input
                        id="new-clabe"
                        placeholder="012345678901234567"
                        value={newBankClabe}
                        onChange={(e) => setNewBankClabe(e.target.value)}
                        maxLength={18}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-beneficiary">Beneficiary name</Label>
                      <Input
                        id="new-beneficiary"
                        placeholder="Full name"
                        value={newBankBeneficiary}
                        onChange={(e) => setNewBankBeneficiary(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-bank">Bank name (optional)</Label>
                    <Input
                      id="new-bank"
                      placeholder="e.g. BBVA"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddFiatAccount}
                    disabled={addingFiatAccount}
                  >
                    {addingFiatAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Add bank account
                  </Button>
                </div>
                {fiatAccounts.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Bank account</Label>
                    <Select value={offFiatAccountId} onValueChange={setOffFiatAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {fiatAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.bankName ? `${a.bankName} ·· ` : ''}{a.accountNumber?.slice(-4) ?? a.id?.slice(0, 8)} ({a.accountHolderName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Amount (USDC)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 100"
                    value={offAmount}
                    onChange={(e) => setOffAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleOffRampQuote}
                    disabled={action !== 'idle' || !isConnected || !offFiatAccountId}
                  >
                    {action === 'quote' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Get quote
                  </Button>
                  {quote && (
                    <Button
                      variant="secondary"
                      onClick={handleStartOffRamp}
                      disabled={action !== 'idle'}
                    >
                      {action === 'offramp' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Start off-ramp
                    </Button>
                  )}
                </div>
                {quote && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p>You send {quote.fromAmount} {quote.fromCurrency} → receive ~{quote.toAmount} {quote.toCurrency}</p>
                  </div>
                )}
                {offRampTx && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="font-medium">Status: {offRampTx.status}</p>
                    {offRampTx.interactiveUrl && (
                      <Button asChild size="sm">
                        <a href={offRampTx.interactiveUrl} target="_blank" rel="noopener noreferrer">
                          View on {config.providers.find((p) => p.id === selectedProvider)?.displayName ?? selectedProvider} <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {offRampTx.signableTransaction && (
                      <Button
                        onClick={handleSignAndSubmitOffRamp}
                        disabled={isSigningOffRamp}
                        size="sm"
                        className="gap-2"
                      >
                        {isSigningOffRamp ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Sign & complete payout
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
