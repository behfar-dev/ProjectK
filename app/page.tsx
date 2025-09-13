'use client'

import { ViewType } from '@/components/auth'
import { AuthDialog } from '@/components/auth-dialog'
import { Chat } from '@/components/chat'
import { ChatInput } from '@/components/chat-input'
import { ChatPicker } from '@/components/chat-picker'
import { ChatSettings } from '@/components/chat-settings'
import { NavBar } from '@/components/navbar'
import { Preview } from '@/components/preview'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { useAuth } from '@/lib/auth'
import { Message, toAISDKMessages, toMessageImage } from '@/lib/messages'
import { LLMModelConfig } from '@/lib/models'
import modelsList from '@/lib/models.json'
import { FragmentSchema, fragmentSchema as schema } from '@/lib/schema'
import { supabase } from '@/lib/supabase'
import templates, { TemplateId } from '@/lib/templates'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { experimental_useObject as useObject } from 'ai/react'
import { usePostHog } from 'posthog-js/react'
import { SetStateAction, useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { EngineerPrompt } from '@/lib/EngineerPrompt'
import { uploadImageToIPFS } from '@/lib/ipfs'
// Modern color palettes for landing pages
const COLOR_PALETTES = [
  {
    id: 'ocean',
    name: 'Diamond Hands',
    colors: ['#0F172A', '#1E40AF', '#3B82F6', '#60A5FA', '#93C5FD'],
    description: 'HODL strong with these diamond hands'
  },
  {
    id: 'sunset',
    name: 'Pump & Dump',
    colors: ['#7C2D12', '#EA580C', '#F97316', '#FB923C', '#FED7AA'],
    description: 'Ride the wave of gains and losses'
  },
  {
    id: 'forest',
    name: 'Green Candles',
    colors: ['#14532D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC'],
    description: 'Nothing but green candles to the moon'
  },
  {
    id: 'royal',
    name: 'Whale Vibes',
    colors: ['#581C87', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD'],
    description: 'Big moves from the biggest players'
  },
  {
    id: 'cyber',
    name: 'Rekt Mode',
    colors: ['#831843', '#BE185D', '#EC4899', '#F472B6', '#FBCFE8'],
    description: 'When you get absolutely destroyed'
  },
  {
    id: 'monochrome',
    name: 'Paper Hands',
    colors: ['#000000', '#374151', '#6B7280', '#9CA3AF', '#F9FAFB'],
    description: 'Weak hands that fold under pressure'
  }
]

export default function Home() {
  const [chatInput, setChatInput] = useLocalStorage('chat', '')
  const [files, setFiles] = useState<File[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<'auto' | TemplateId>(
    'auto',
  )
  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
    'languageModel',
    {
      model: 'gpt-5',
    },
  )

  const posthog = usePostHog()

  const [result, setResult] = useState<ExecutionResult>()
  const [messages, setMessages] = useState<Message[]>([])
  const [fragment, setFragment] = useState<DeepPartial<FragmentSchema>>()
  const [currentTab, setCurrentTab] = useState<'code' | 'fragment'>('code')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isAuthDialogOpen, setAuthDialog] = useState(false)
  const [authView, setAuthView] = useState<ViewType>('sign_in')
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { session, userTeam } = useAuth(setAuthDialog, setAuthView)

  // Onboarding state
  const [isOnboarding, setIsOnboarding] = useState(true)
  const [onboardingStep, setOnboardingStep] = useState<'details' | 'prompt'>('details')
  const [tokenLogo, setTokenLogo] = useState<File | null>(null)
  const [tokenLogoPreview, setTokenLogoPreview] = useState<string>('')
  const [ipfsLogoUrl, setIpfsLogoUrl] = useState<string>('')
  const [tokenName, setTokenName] = useState('')
  const [tokenTicker, setTokenTicker] = useState('')
  const [initialBuyAmount, setInitialBuyAmount] = useState<number | ''>('')
  const [projectDescription, setProjectDescription] = useState('')
  const [landingPrompt, setLandingPrompt] = useState('')
  const [socialsOpen, setSocialsOpen] = useState(false)
  const [twitter, setTwitter] = useState('')
  const [website, setWebsite] = useState('')
  const [selectedColorPalette, setSelectedColorPalette] = useState<string>('')

  const filteredModels = modelsList.models.filter((model) => {
    if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
      
      return model.providerId !== 'ollama' && model.providerId !== 'mistral' && model.providerId !== 'google' && model.providerId !== 'anthropic' && model.providerId !== 'xai' && model.providerId !== 'groq' && model.providerId !== 'togetherai' && model.providerId !== 'fireworks' && model.providerId !== 'vertex' && model.providerId !== 'deepseek' && model.providerId !== 'groq' 
    }

    
   
    return true
  })

  const currentModel = filteredModels.find(
    (model) => model.id === languageModel.model,
  )
  const currentTemplate =
    selectedTemplate === 'auto'
      ? templates
      : { [selectedTemplate]: templates[selectedTemplate] }
  const lastMessage = messages[messages.length - 1]

  const { object, submit, isLoading, stop, error } = useObject({
    api: '/api/chat',
    schema,
    onError: (error) => {
      console.error('Error submitting request:', error)
      if (error.message.includes('limit')) {
        setIsRateLimited(true)
      }

      setErrorMessage(error.message)
    },
    onFinish: async ({ object: fragment, error }) => {
      if (!error) {
        // send it to /api/sandbox
        console.log('fragment', fragment)
        setIsPreviewLoading(true)
        posthog.capture('fragment_generated', {
          template: fragment?.template,
        })

        const response = await fetch('/api/sandbox', {
          method: 'POST',
          body: JSON.stringify({
            fragment,
            userID: session?.user?.id,
            teamID: userTeam?.id,
            accessToken: session?.access_token,
          }),
        })

        const result = await response.json()
        console.log('result', result)
        posthog.capture('sandbox_created', { url: result.url })

        setResult(result)
        setCurrentPreview({ fragment, result })
        setMessage({ result })
        setCurrentTab('fragment')
        setIsPreviewLoading(false)
      }
    },
  })

  const addMessage = useCallback((message: Message) => {
    setMessages((previousMessages) => [...previousMessages, message])
  }, [])

  useEffect(() => {
    if (!object) return

    setFragment(object)

    const content: Message['content'] = [
      { type: 'text', text: object.commentary || '' },
      { type: 'code', text: object.code || '' },
    ]

    setMessages((previousMessages) => {
      const previousLast = previousMessages[previousMessages.length - 1]

      if (!previousLast || previousLast.role !== 'assistant') {
        return [
          ...previousMessages,
          { role: 'assistant', content, object } as Message,
        ]
      }

      const contentJson = JSON.stringify(content)
      const prevContentJson = JSON.stringify(previousLast.content)
      if (contentJson === prevContentJson) return previousMessages

      const updated = [...previousMessages]
      updated[updated.length - 1] = {
        ...previousLast,
        content,
        object,
      }
      return updated
    })
  }, [object])

  useEffect(() => {
    if (error) stop()
  }, [error, stop])

  function setMessage(message: Partial<Message>, index?: number) {
    setMessages((previousMessages) => {
      const updatedMessages = [...previousMessages]
      updatedMessages[index ?? previousMessages.length - 1] = {
        ...previousMessages[index ?? previousMessages.length - 1],
        ...message,
      }

      return updatedMessages
    })
  }

  async function handleSubmitAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!session) {
      return setAuthDialog(true)
    }

    if (isLoading) {
      stop()
    }

    const content: Message['content'] = [{ type: 'text', text: chatInput }]
    const images = await toMessageImage(files)

    if (images.length > 0) {
      images.forEach((image) => {
        content.push({ type: 'image', image })
      })
    }

    const newMessage: Message = {
      role: 'user',
      content,
    }
    addMessage(newMessage)
    const updatedMessages = [...messages, newMessage]

    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(updatedMessages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })

    setChatInput('')
    setFiles([])
    setCurrentTab('code')

    posthog.capture('chat_submit', {
      template: selectedTemplate,
      model: languageModel.model,
    })
  }

  function retry() {
    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(messages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })
  }

  function handleSaveInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setChatInput(e.target.value)
  }

  function handleFileChange(change: SetStateAction<File[]>) {
    setFiles(change)
  }

  function logout() {
    supabase
      ? supabase.auth.signOut()
      : console.warn('Supabase is not initialized')
  }

  function handleLanguageModelChange(e: LLMModelConfig) {
    setLanguageModel({ ...languageModel, ...e })
  }

  function handleSocialClick(target: 'github' | 'x' | 'discord') {
    if (target === 'github') {
      window.open('https://github.com/handzfun', '_blank')
    } else if (target === 'x') {
      window.open('https://x.com/handzfun', '_blank')
    } else if (target === 'discord') {
      window.open('https://discord.gg/handz', '_blank')
    }

    posthog.capture(`${target}_click`)
  }

  function handleClearChat() {
    stop()
    setChatInput('')
    setFiles([])
    setMessages([])
    setFragment(undefined)
    setResult(undefined)
    setCurrentTab('code')
    setIsPreviewLoading(false)
    // Reset onboarding if user clears everything
    setIsOnboarding(true)
    setOnboardingStep('details')
    setTokenLogo(null)
    setTokenLogoPreview('')
    setTokenName('')
    setTokenTicker('')
    setInitialBuyAmount('')
    setProjectDescription('')
    setLandingPrompt('')
    setSocialsOpen(false)
    setTwitter('')
    setWebsite('')
    setSelectedColorPalette('')
  }

  function setCurrentPreview(preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) {
    setFragment(preview.fragment)
    setResult(preview.result)
  }

  function handleUndo() {
    setMessages((previousMessages) => [...previousMessages.slice(0, -2)])
    setCurrentPreview({ fragment: undefined, result: undefined })
  }

  // Onboarding helpers
  function handleLogoInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setTokenLogo(file)
      setTokenLogoPreview(URL.createObjectURL(file))
      // Upload to IPFS immediately so generated site can reference a stable URL
      uploadImageToIPFS(file)
        .then((uri) => setIpfsLogoUrl(uri))
        .catch((err) => console.warn('IPFS upload failed', err))
    }
  }

  function nextFromDetails() {
    if (!tokenName || !tokenTicker || !tokenLogo) return
    setOnboardingStep('prompt')
  }

  async function startTokenBuild() {
    const content: Message['content'] = []
    const selectedPalette = COLOR_PALETTES.find(p => p.id === selectedColorPalette)
    const lines: string[] = [
      `Token Name: ${tokenName}`,
      `Ticker: ${tokenTicker}`,
      '',
      'Project Description:',
      projectDescription,
      website ? `Website: ${website}` : '',
      twitter ? `Twitter: ${twitter}` : '',
      ipfsLogoUrl ? `MAIN TOKEN IMAGE URL: ${ipfsLogoUrl}` : '',
      '',
      selectedPalette ? `Color Palette: ${selectedPalette.name} - ${selectedPalette.description}. Use these colors: ${selectedPalette.colors.join(', ')}` : '',
      '',
      'Landing Page Prompt:',
      landingPrompt,
      '',
      'Please generate a modern, high-converting landing page for this token project, including hero, tokenomics, roadmap, FAQs, and clear CTAs. Use the uploaded logo and apply the specified color palette for a cohesive design.',
    ]
    content.push({ type: 'text', text: lines.join('\n') })

    if (tokenLogo) {
      try {
        const image = await toMessageImage([tokenLogo])
        if (image.length > 0) {
          content.push({ type: 'image', image: image[0] })
        }
      } catch (e) {
        console.warn('Failed to attach logo image', e)
      }
    }

    const newMessage: Message = { role: 'user', content }
    addMessage(newMessage)
    const updatedMessages = [...messages, newMessage]

    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(updatedMessages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })

    setIsOnboarding(false)
    setCurrentTab('code')
    setIsPreviewLoading(false)

    posthog.capture('token_builder_start', {
      name: tokenName,
      ticker: tokenTicker,
      initialBuy: initialBuyAmount || 0,
    })
  }

  return (
    <main className="flex min-h-screen max-h-screen">
      {supabase && (
        <AuthDialog
          open={isAuthDialogOpen}
          setOpen={setAuthDialog}
          view={authView}
          supabase={supabase}
        />
      )}
      {isOnboarding ? (
        <div className="flex w-full items-start justify-center p-6">
          <div className="w-full max-w-5xl">
            <NavBar
              session={session}
              showLogin={() => setAuthDialog(true)}
              signOut={logout}
              onSocialClick={handleSocialClick}
              onClear={handleClearChat}
              canClear={messages.length > 0}
              canUndo={false}
              onUndo={handleUndo}
            />

            <div className="mt-6">
              <h1 className="text-4xl font-bold tracking-tight">Create New Coin</h1>
              <p className="mt-2 text-muted-foreground">Choose carefully, these can’t be changed once the coin is created</p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card className="md:col-span-2 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base text-muted-foreground">Coin Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="token-name">Coin Name</Label>
                      <Input id="token-name" placeholder="Name your coin" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="token-ticker">Ticker</Label>
                      <Input id="token-ticker" placeholder="Add a coin ticker e.g (DOGE)" value={tokenTicker} onChange={(e) => setTokenTicker(e.target.value.toUpperCase())} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="project-description">Description</Label>
                      <span className="text-xs text-muted-foreground">(Optional)</span>
                    </div>
                    <textarea id="project-description" className="min-h-[120px] rounded-xl border bg-transparent p-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Write a short description..." value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <button type="button" className="text-sm text-muted-foreground" onClick={() => setSocialsOpen((v) => !v)}>
                      Add social links <span className="text-xs">(Optional)</span>
                    </button>
                    {socialsOpen && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Input placeholder="Website (https://...)" value={website} onChange={(e) => setWebsite(e.target.value)} />
                        <Input placeholder="Twitter / X (@handle or url)" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-1 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base text-muted-foreground">Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="rounded-2xl border bg-gradient-to-br from-background to-background/40 p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 rounded-xl border overflow-hidden bg-muted">
                          {tokenLogoPreview && (
                            <Image src={tokenLogoPreview} alt="Token preview" className="h-full w-full object-cover" width={64} height={64} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-semibold truncate">{tokenName || 'Token Name'}</div>
                          <div className="text-xs text-muted-foreground">{tokenTicker || 'TICKER'}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground line-clamp-3 min-h-[3.5rem]">
                        {projectDescription || 'A preview of how the coin will look like'}
                      </div>
                      <div className="mt-4">
                        <Button variant="outline" className="w-full" onClick={() => document.getElementById('token-logo')?.click()}>
                          {tokenLogoPreview ? 'Change image' : 'Upload image'}
                        </Button>
                        <input id="token-logo" type="file" accept="image/*,video/*" className="hidden" onChange={handleLogoInput} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="mt-6 flex justify-between items-center">
              <div className="text-xs text-muted-foreground">Step {['details','prompt'].indexOf(onboardingStep) + 1} / 2</div>
              {onboardingStep === 'details' && (
                <Button size="lg" onClick={nextFromDetails} disabled={!tokenName || !tokenTicker || !tokenLogo}>Continue</Button>
              )}
            </div>

            {onboardingStep === 'prompt' && (
              <div className="mt-6 space-y-6">
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle>Choose Your Color Palette</CardTitle>
                    <p className="text-sm text-muted-foreground">Select a color scheme that matches your project&apos;s vibe</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {COLOR_PALETTES.map((palette) => (
                        <div
                          key={palette.id}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                            selectedColorPalette === palette.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedColorPalette(palette.id)}
                        >
                          <div className="flex gap-2 mb-3">
                            {palette.colors.map((color, i) => (
                              <div
                                key={i}
                                className="w-6 h-6 rounded-full border border-border/20"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <h4 className="font-medium text-sm">{palette.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{palette.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle>Describe your Landing Page and Project</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2">
                      <ChatPicker
                        templates={templates}
                        selectedTemplate={selectedTemplate}
                        onSelectedTemplateChange={setSelectedTemplate}
                        models={filteredModels}
                        languageModel={languageModel}
                        onLanguageModelChange={handleLanguageModelChange}
                      />
                    </div>
                    <ChatInput
                      retry={retry}
                      isErrored={false}
                      errorMessage={''}
                      isLoading={isLoading}
                      isRateLimited={false}
                      stop={stop}
                      input={landingPrompt}
                      placeholder={'Describe your landing page sections, vibe, tone, and goals...'}
                      handleInputChange={(e) => setLandingPrompt(e.target.value)}
                      handleSubmit={(e) => { e.preventDefault(); startTokenBuild() }}
                      isMultiModal={true}
                      files={tokenLogo ? [tokenLogo] as unknown as File[] : []}
                      handleFileChange={() => {}}
                      hideAttachmentControls
                    >
                      <div />
                    </ChatInput>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </div>
      ) : (
        <div className="grid w-full md:grid-cols-2">
          <div
            className={`flex flex-col w-full max-h-full max-w-[800px] mx-auto px-4 overflow-auto ${fragment ? 'col-span-1' : 'col-span-2'}`}
          >
            <NavBar
              session={session}
              showLogin={() => setAuthDialog(true)}
              signOut={logout}
              onSocialClick={handleSocialClick}
              onClear={handleClearChat}
              canClear={messages.length > 0}
              canUndo={messages.length > 1 && !isLoading}
              onUndo={handleUndo}
            />
            <Chat
              messages={messages}
              isLoading={isLoading}
              setCurrentPreview={setCurrentPreview}
            />
            <ChatInput
              retry={retry}
              isErrored={error !== undefined}
              errorMessage={errorMessage}
              isLoading={isLoading}
              isRateLimited={isRateLimited}
              stop={stop}
              input={chatInput}
              placeholder={'Tell the builder how to iterate further...'}
              handleInputChange={handleSaveInputChange}
              handleSubmit={handleSubmitAuth}
              isMultiModal={currentModel?.multiModal || false}
              files={files}
              handleFileChange={handleFileChange}
            >
              <ChatPicker
                templates={templates}
                selectedTemplate={selectedTemplate}
                onSelectedTemplateChange={setSelectedTemplate}
                models={filteredModels}
                languageModel={languageModel}
                onLanguageModelChange={handleLanguageModelChange}
              />
            </ChatInput>
          </div>
          <Preview
            teamID={userTeam?.id}
            accessToken={session?.access_token}
            selectedTab={currentTab}
            onSelectedTabChange={setCurrentTab}
            isChatLoading={isLoading}
            isPreviewLoading={isPreviewLoading}
            fragment={fragment}
            result={result as ExecutionResult}
            onClose={() => setFragment(undefined)}
            initialName={tokenName}
            initialTicker={tokenTicker}
            initialDescription={projectDescription}
            initialImageFile={tokenLogo}
          />
        </div>
      )}
    </main>
  )
}
