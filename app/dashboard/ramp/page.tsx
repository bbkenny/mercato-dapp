'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  CircleDollarSign,
} from 'lucide-react'
import { RampProvider, useRamp } from '@/components/ramp/ramp-provider'
import { ProviderSelector } from '@/components/ramp/provider-selector'
import { WalletBanner } from '@/components/ramp/wallet-banner'
import { OnRampForm } from '@/components/ramp/on-ramp-form'
import { OffRampForm } from '@/components/ramp/off-ramp-form'

function RampContent() {
  const { state } = useRamp()
  const [activeTab, setActiveTab] = useState('on-ramp')

  if (state.loading) {
    return (
      <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading ramp providers…</p>
        </div>
      </div>
    )
  }

  if (!state.config?.enabled) {
    return (
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
              No ramp providers are configured. Set env vars for at least one
              provider (Etherfuse, AlfredPay, BlindPay) in your environment. See
              env.sample.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </Button>

      <div className="mt-6 mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2.5">
          <CircleDollarSign className="h-6 w-6 text-primary" aria-hidden />
          Add funds & Cash out
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Convert between local currency and USDC on Stellar. Choose a provider,
          enter an amount, and follow the steps.
        </p>
      </div>

      <ProviderSelector />
      <WalletBanner />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="on-ramp" className="gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            Add funds
          </TabsTrigger>
          <TabsTrigger value="off-ramp" className="gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Cash out
          </TabsTrigger>
        </TabsList>

        <TabsContent value="on-ramp">
          <OnRampForm />
        </TabsContent>

        <TabsContent value="off-ramp">
          <OffRampForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function RampPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <Suspense
        fallback={
          <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-8">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          </div>
        }
      >
        <RampProvider>
          <RampContent />
        </RampProvider>
      </Suspense>
    </div>
  )
}
