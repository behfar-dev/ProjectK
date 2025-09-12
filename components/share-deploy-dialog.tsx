"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { usePostHog } from 'posthog-js/react'
import { useTokenCreation } from '@/app/hooks/pumpfun'
import { publish } from '@/app/actions/publish'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CopyButton } from '@/components/ui/copy-button'
import { gsap } from 'gsap'
import { Rocket, Zap, Star, Crown, Copy, ExternalLink, CheckCircle2, Coins, TrendingUp, X } from 'lucide-react'
import Image from 'next/image'

type Props = {
  url: string
  sbxId: string
  teamID: string | undefined
  accessToken: string | undefined
  initialName?: string
  initialTicker?: string
  initialDescription?: string
  initialWebsite?: string
  initialImageFile?: File | null
}

export function ShareDeployDialog({ url, sbxId, teamID, accessToken, initialName, initialTicker, initialDescription, initialWebsite, initialImageFile }: Props) {
  const wallet = useWallet()
  const walletModal = useWalletModal()
  const posthog = usePostHog()
  const { state, createToken, reset } = useTokenCreation()

  const [open, setOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const [name, setName] = useState(initialName || '')
  const [symbol, setSymbol] = useState(initialTicker || '')
  const [website, setWebsite] = useState(initialWebsite || url)
  const [twitter, setTwitter] = useState('')
  const [description, setDescription] = useState(initialDescription || '')
  const [file, setFile] = useState<File | null>(initialImageFile || null)
  const [imagePreview, setImagePreview] = useState<string>('')

  const [devBuyAmount, setDevBuyAmount] = useState<number>(0.01)
  const [slippage, setSlippage] = useState<number>(10)
  const [priorityFee, setPriorityFee] = useState<number>(0.0005)
  const [publishedURL, setPublishedURL] = useState<string | null>(null)
  const [selectedPool, setSelectedPool] = useState<'pump' | 'bonk' | 'moonshot'>('pump')
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // GSAP refs
  const modalRef = useRef<HTMLDivElement>(null)
  const successModalRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const poolSelectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setName(initialName || '')
    setSymbol(initialTicker || '')
    setDescription(initialDescription || '')
    setWebsite(initialWebsite || url)
    setFile(initialImageFile || null)
  }, [initialName, initialTicker, initialDescription, initialWebsite, initialImageFile, url])

  useEffect(() => {
    if (file) {
      const objectUrl = URL.createObjectURL(file)
      setImagePreview(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    } else {
      setImagePreview('')
    }
  }, [file])

  // GSAP animations
  useEffect(() => {
    if (open && modalRef.current) {
      gsap.fromTo(modalRef.current, 
        { scale: 0.8, opacity: 0, y: 50 },
        { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.7)" }
      )
      
      if (formRef.current) {
        gsap.fromTo(formRef.current.children,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, delay: 0.2 }
        )
      }
    }
  }, [open])

  useEffect(() => {
    if (showSuccessModal && successModalRef.current) {
      gsap.fromTo(successModalRef.current,
        { scale: 0.5, opacity: 0, rotationY: 180 },
        { scale: 1, opacity: 1, rotationY: 0, duration: 0.8, ease: "power3.out" }
      )
    }
  }, [showSuccessModal])

  // Watch for successful token creation to show success modal
  useEffect(() => {
    if (state.result && !state.isLoading) {
      setShowSuccessModal(true)
    }
  }, [state.result, state.isLoading])

  // Pool selector animations
  const animatePoolSelection = (pool: 'pump' | 'bonk' | 'moonshot') => {
    if (poolSelectorRef.current) {
      const buttons = poolSelectorRef.current.querySelectorAll('[data-pool]')
      buttons.forEach((button) => {
        const isSelected = button.getAttribute('data-pool') === pool
        gsap.to(button, {
          scale: isSelected ? 1.05 : 1,
          y: isSelected ? -2 : 0,
          duration: 0.3,
          ease: "power2.out"
        })
      })
    }
  }

  async function handleShareAndDeploy() {
    const tokenImage = file || initialImageFile
    if (!tokenImage) {
      console.error('No image file available for token creation');
      return;
    }
    if (!wallet.connected) {
      walletModal.setVisible(true)
      return
    }

    console.log('Starting deploy process with:', {
      name,
      symbol,
      description,
      twitter,
      website,
      file: tokenImage ? `${tokenImage.name} (${tokenImage.size} bytes, ${tokenImage.type})` : 'No file'
    });

    // 1) Publish preview URL with 30min expiry
    setIsPublishing(true)
    const { url: sharedUrl } = await publish(url, sbxId, '30m', teamID, accessToken)
    setPublishedURL(sharedUrl)
    posthog.capture('publish_url', { url: sharedUrl })
    setIsPublishing(false)

    // 2) Create Pump.fun token
    console.log('Creating token with wallet:', wallet.publicKey?.toBase58());
    await createToken(
      {
        name,
        symbol,
        description,
        twitter,
        website,
        file: tokenImage,
        showName: true,
      },
      {
        rpcEndpoint:
          process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://capable-virulent-sheet.solana-mainnet.quiknode.pro/6c2f6e46571625b28e692fee5b4f34edcf4a047d',
        amount: devBuyAmount,
        denominatedInSol: true,
        slippage,
        priorityFee,
        pool: selectedPool,
      },
      wallet as any,
    )

    posthog.capture('pump_token_deploy_attempt', { pool: selectedPool })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  function closeAndReset() {
    setOpen(false)
    setPublishedURL(null)
    setShowSuccessModal(false)
    reset()
  }

  // Pool options with metadata (only Pump.fun for now)
  const poolOptions = [
    {
      id: 'pump' as const,
      name: 'Pump.fun',
      icon: '🚀',
      color: 'from-green-400 to-green-600',
      description: 'Fast & easy token launch',
      fee: '0% platform fee'
    }
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="default"
        onClick={async () => {
          if (!wallet.connected) {
            walletModal.setVisible(true)
            return
          }
          setOpen(true)
        }}
        className={!wallet.connected ? 'animate-pulse' : ''}
      >
        {wallet.connected ? 'Deploy Token' : 'Connect Wallet to Deploy'}
      </Button>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-2 border-gradient">
        <div ref={modalRef} className="w-full">
          <DialogHeader className="text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🚀 Launch Your Token
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">Create and deploy your token to Solana in minutes</p>
          </DialogHeader>
          
          <div ref={formRef} className="space-y-6">
            {/* Wallet Status */}
            {wallet.connected ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 shadow-lg">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-green-800">Wallet Connected</span>
                  <p className="text-xs text-green-600 font-mono">
                    {wallet.publicKey?.toBase58().slice(0, 8)}...{wallet.publicKey?.toBase58().slice(-8)}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 shadow-lg">
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-orange-800">Connect Wallet</span>
                  <p className="text-xs text-orange-600">Required to deploy tokens</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => walletModal.setVisible(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Connect
                </Button>
              </div>
            )}

            {/* Pool Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                <Label className="text-base font-semibold">Launch Platform</Label>
              </div>
              <div ref={poolSelectorRef} className="flex gap-3">
                {poolOptions.map((pool) => (
                  <button
                    key={pool.id}
                    data-pool={pool.id}
                    onClick={() => {
                      setSelectedPool(pool.id)
                      animatePoolSelection(pool.id)
                    }}
                    className={`flex-1 relative p-4 rounded-xl border-2 transition-all duration-300 ${
                      selectedPool === pool.id
                        ? 'border-purple-500 bg-gradient-to-r ' + pool.color + ' text-white shadow-lg'
                        : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{pool.icon}</div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-sm">{pool.name}</div>
                        <div className={`text-xs ${selectedPool === pool.id ? 'text-white/90' : 'text-gray-600'}`}>
                          {pool.description}
                        </div>
                      </div>
                      <div className={`text-xs font-mono ${selectedPool === pool.id ? 'text-white/80' : 'text-gray-500'}`}>
                        {pool.fee}
                      </div>
                    </div>
                    {selectedPool === pool.id && (
                      <div className="absolute top-2 right-2">
                        <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            {/* Token Preview Card */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-xl border-2 border-indigo-300 overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100">
                  {imagePreview ? (
                    <Image src={imagePreview} alt="token logo" className="w-full h-full object-cover" width={80} height={80} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Coins className="w-8 h-8 text-indigo-400" />
                    </div>
                  )}
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <Star className="w-3 h-3 text-white fill-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-indigo-900">{name || 'Your Token Name'}</h3>
                  <p className="text-sm font-mono text-indigo-600 bg-indigo-100 px-2 py-1 rounded">${symbol || 'TICKER'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-indigo-700">Ready to launch</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-500" />
                Token Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Token Name</Label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter token name"
                    className="border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Ticker Symbol</Label>
                  <Input 
                    value={symbol} 
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())} 
                    placeholder="e.g. HANDZ"
                    className="border-2 border-gray-200 focus:border-blue-500 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Description</Label>
                <Input 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Brief description of your token"
                  className="border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Website</Label>
                  <Input 
                    value={website} 
                    onChange={(e) => setWebsite(e.target.value)} 
                    placeholder="https://yoursite.com"
                    className="border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Twitter</Label>
                  <Input 
                    value={twitter} 
                    onChange={(e) => setTwitter(e.target.value)} 
                    placeholder="@handle or full URL"
                    className="border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                  />
                </div>
              </div>

            </div>

            {/* Trading Settings */}
            <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Trading Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Dev Buy (SOL)</Label>
                  <Input 
                    type="number" 
                    step="0.001" 
                    min="0" 
                    value={devBuyAmount} 
                    onChange={(e) => setDevBuyAmount(Number(e.target.value))}
                    className="border-2 border-yellow-200 focus:border-yellow-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Slippage (%)</Label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    value={slippage} 
                    onChange={(e) => setSlippage(Number(e.target.value))}
                    className="border-2 border-yellow-200 focus:border-yellow-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Priority Fee (SOL)</Label>
                  <Input 
                    type="number" 
                    step="0.0001" 
                    min="0" 
                    value={priorityFee} 
                    onChange={(e) => setPriorityFee(Number(e.target.value))}
                    className="border-2 border-yellow-200 focus:border-yellow-500 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-4">
              <Button
                onClick={handleShareAndDeploy}
                disabled={state.isLoading || isPublishing || !name || !symbol || !wallet.connected || (!file && !initialImageFile)}
                className="w-full h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <div className="flex items-center gap-3">
                  {state.isLoading || isPublishing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deploying...</span>
                    </>
                  ) : !wallet.connected ? (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>Connect Wallet First</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      <span>🚀 Launch Token</span>
                    </>
                  )}
                </div>
              </Button>
            </div>

            {/* Progress Indicator */}
            {(state.isLoading || isPublishing) && (
              <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-blue-900">
                      {isPublishing ? '📤 Publishing Preview...' : 
                       state.isUploadingMetadata ? '☁️ Uploading to IPFS...' :
                       state.isCreatingTransaction ? '⚡ Creating Transaction...' :
                       state.isSubmittingTransaction ? '🌐 Broadcasting to Solana...' :
                       '🔄 Processing...'}
                    </h3>
                    <p className="text-sm text-blue-700">
                      {isPublishing ? 'Creating shareable link with 30min expiry' : 
                       state.isUploadingMetadata ? 'Uploading token image and metadata to IPFS' :
                       state.isCreatingTransaction ? 'Preparing blockchain transaction with your settings' :
                       state.isSubmittingTransaction ? 'Confirming transaction on Solana network' :
                       'Processing your token deployment...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{Math.round(state.progress)}%</div>
                    <div className="text-xs text-blue-500">Complete</div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Results Section */}
            {state.error && (
              <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                    <X className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-red-800">❌ Deployment Failed</h3>
                </div>
                <p className="text-sm text-red-700 bg-red-100 p-3 rounded-lg">{state.error}</p>
                <Button 
                  onClick={closeAndReset}
                  className="mt-4 w-full bg-red-500 hover:bg-red-600 text-white"
                >
                  Try Again
                </Button>
              </div>
            )}

            {publishedURL && !state.result && (
              <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-blue-800">📤 Preview Published</h3>
                  <span className="text-xs text-blue-600 bg-blue-100 px-3 py-1 rounded-full font-semibold">30min expiry</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={publishedURL} readOnly className="bg-white border-blue-200" />
                  <CopyButton content={publishedURL} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(publishedURL, '_blank')}
                    className="border-blue-300 hover:bg-blue-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-lg bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div ref={successModalRef} className="text-center space-y-6">
            {/* Success Header */}
            <div className="relative">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
                <Star className="w-4 h-4 text-yellow-800 fill-yellow-800" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-green-800 mb-2">🎉 Token Launched Successfully!</h2>
              <p className="text-green-700">Your token is now live on the Solana blockchain</p>
            </div>

            {/* Token Card */}
            {state.result && (
              <div className="p-6 bg-white rounded-xl border border-green-200 shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-green-300 overflow-hidden bg-gradient-to-br from-green-100 to-emerald-100">
                    {imagePreview ? (
                      <Image src={imagePreview} alt="token logo" className="w-full h-full object-cover" width={80} height={80} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Coins className="w-8 h-8 text-green-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-xl font-bold text-gray-900">{name}</h3>
                    <p className="text-sm font-mono text-green-600 bg-green-100 px-2 py-1 rounded inline-block">${symbol}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-700 font-semibold">LIVE ON {selectedPool.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Token Details */}
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Mint Address:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-gray-100 rounded text-xs font-mono break-all">
                        {state.result.mintAddress}
                      </code>
                      <CopyButton content={state.result.mintAddress} />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => window.open(state.result?.transactionUrl, '_blank')}
                    className="flex items-center gap-2 border-green-300 hover:bg-green-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Transaction
                  </Button>
                  <Button
                    onClick={() => {
                      // Copy mint address and show toast
                      navigator.clipboard.writeText(state.result?.mintAddress || '')
                    }}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Address
                  </Button>
                </div>
              </div>
            )}

            {/* Close Button */}
            <Button 
              onClick={closeAndReset}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3"
            >
              🚀 Create Another Token
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}


