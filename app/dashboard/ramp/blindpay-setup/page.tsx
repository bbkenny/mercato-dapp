'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { useWallet } from '@/hooks/use-wallet'
import { SUPPORTED_COUNTRIES } from '@/lib/constants'
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function BlindPaySetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { walletInfo, isConnected, handleConnect } = useWallet()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [tosId, setTosId] = useState('')
  const [receiverId, setReceiverId] = useState('')
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    tax_id: '',
    address_line_1: '',
    city: '',
    state_province_region: '',
    country: 'MX',
    postal_code: '',
    phone_number: '',
    date_of_birth: '',
  })

  useEffect(() => {
    const id = searchParams.get('tos_id')
    if (id) {
      setTosId(id)
      setStep(2)
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    async function getEmail() {
      try {
        const res = await fetch('/api/ramp/config')
        if (res.ok) {
          const profileRes = await fetch('/api/ramp/customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'blindpay' }),
          })
          if (profileRes.ok) {
            const data = await profileRes.json()
            if (!cancelled && data.email) setUserEmail(data.email)
          }
        }
      } catch {
        // ignore
      }
    }
    getEmail()
    return () => { cancelled = true }
  }, [])

  const handleOpenTos = async () => {
    setLoading(true)
    try {
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/dashboard/ramp/blindpay-setup`
        : ''
      const res = await fetch(
        `/api/ramp/blindpay/tos-url?provider=blindpay&redirectUrl=${encodeURIComponent(redirectUrl)}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get ToS URL')
      window.open(data.url, '_blank', 'noopener,noreferrer')
      toast.success('Complete the Terms of Service in the new tab, then return here.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to open ToS')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/ramp/blindpay/receiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tos_id: tosId,
          type: 'individual',
          kyc_type: 'standard',
          email: form.email || userEmail,
          tax_id: form.tax_id,
          address_line_1: form.address_line_1,
          city: form.city,
          state_province_region: form.state_province_region,
          country: form.country,
          postal_code: form.postal_code,
          ip_address: '127.0.0.1',
          phone_number: form.phone_number,
          first_name: form.first_name,
          last_name: form.last_name,
          date_of_birth: form.date_of_birth || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create receiver')
      setReceiverId(data.id)
      setStep(3)
      toast.success('KYC submitted. Register your wallet next.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit KYC')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterWallet = async () => {
    if (!walletInfo?.address) {
      toast.error('Connect your Stellar wallet first')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ramp/blindpay/register-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId,
          address: walletInfo.address,
          name: 'Stellar Wallet',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to register wallet')
      toast.success('BlindPay setup complete!')
      router.push(`/dashboard/ramp?provider=blindpay&blindpay_setup=${encodeURIComponent(data.compositeId)}&blindpay_email=${encodeURIComponent(form.email || userEmail)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to register wallet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto max-w-lg px-4 py-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/ramp" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Ramp
          </Link>
        </Button>
        <h1 className="mt-6 text-2xl font-bold">BlindPay Onboarding</h1>
        <p className="mt-1 text-muted-foreground">
          Complete these steps to add funds via BlindPay.
        </p>

        <div className="mt-8 space-y-6">
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
                  Accept Terms of Service
                </CardTitle>
                <CardDescription>
                  Open the link below to accept BlindPay&apos;s Terms of Service. You may need to complete this in a new tab. After accepting, return to this page — you may be redirected back automatically with a confirmation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleOpenTos} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Open Terms of Service
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">
                  If you were redirected back with a <code>tos_id</code> in the URL, you can continue to Step 2.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    const id = prompt('Paste the tos_id from the ToS completion page (if BlindPay showed it):')
                    if (id) {
                      setTosId(id)
                      setStep(2)
                    }
                  }}
                >
                  I have a tos_id
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {tosId ? (
                    <CheckCircle2 className="h-7 w-7 text-green-500" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
                  )}
                  KYC Information
                </CardTitle>
                <CardDescription>
                  Enter your details for BlindPay verification. On development instances, KYC is usually auto-approved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitKyc} className="space-y-4">
                  {!tosId && (
                    <div className="grid gap-2">
                      <Label>TOS ID (from Step 1)</Label>
                      <Input
                        placeholder="to_xxx"
                        value={tosId}
                        onChange={(e) => setTosId(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>First name</Label>
                      <Input
                        value={form.first_name}
                        onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Last name</Label>
                      <Input
                        value={form.last_name}
                        onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email || userEmail}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder={userEmail || 'you@example.com'}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tax ID (e.g. CURP for Mexico)</Label>
                    <Input
                      value={form.tax_id}
                      onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
                      placeholder="CURP or RFC"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Address</Label>
                    <Input
                      value={form.address_line_1}
                      onChange={(e) => setForm((f) => ({ ...f, address_line_1: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>City</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>State / Region</Label>
                      <Input
                        value={form.state_province_region}
                        onChange={(e) => setForm((f) => ({ ...f, state_province_region: e.target.value }))}
                        placeholder="CDMX"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Country</Label>
                      <Select
                        value={form.country}
                        onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Postal code</Label>
                      <Input
                        value={form.postal_code}
                        onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Phone (E.164)</Label>
                      <Input
                        value={form.phone_number}
                        onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                        placeholder="+525512345678"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Date of birth</Label>
                      <Input
                        type="date"
                        value={form.date_of_birth}
                        onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit KYC
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-7 w-7 text-green-500" />
                  Register your Stellar wallet
                </CardTitle>
                <CardDescription>
                  Connect your Stellar wallet to receive USDC when you add funds via BlindPay.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isConnected ? (
                  <Button onClick={handleConnect}>Connect wallet</Button>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Wallet: {walletInfo?.address?.slice(0, 8)}…{walletInfo?.address?.slice(-8)}
                    </p>
                    <Button onClick={handleRegisterWallet} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Register this wallet
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
