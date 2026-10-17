'use client'
import { type Provider } from '@/lib/api'

interface HeaderProps {
  providers: Provider[]
  provider: string
  serviceHealth: any
  onProviderChange: (id: string) => void
  onSettings: () => void
  onNewChat: () => void
}

export default function Header({ providers, provider, serviceHealth, onProviderChange, onSettings, onNewChat }: HeaderProps) {
  const aiButtons = [
    { id: 'ollama', label: 'Local' },
    { id: 'claude', label: 'Claude' },
    { id: 'openai', label: 'GPT' },
    { id: 'openrouter', label: 'OpenRouter' },
  ]

  return (
    <header className="col-span-full bg-cs-bg2 border-b border-cs-border flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={onNewChat}>
        <div className="w-7 h-7 rounded-md border border-cs-border2 bg-cs-bg3 flex items-center justify-center text-xs font-semibold text-cs-text">CA</div>
        <div className="leading-tight">
          <div className="font-semibold text-sm text-cs-text">Cyber Agentic AI</div>
          <div className="text-[0.7rem] text-cs-text3">built on CyberSentinel AI (open source)</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 bg-cs-bg3 border border-cs-border rounded-md p-0.5" role="group" aria-label="AI provider">
          {aiButtons.map(ai => {
            const prov = providers.find(p => p.id === ai.id)
            const isActive = provider === ai.id
            const isAvail = prov?.configured || ai.id === 'ollama'
            return (
              <button
                key={ai.id}
                onClick={() => isAvail && onProviderChange(ai.id)}
                title={isActive ? `Active: ${prov?.model || ai.id}` : isAvail ? `Switch to ${ai.label}` : `${ai.label} - no API key configured`}
                aria-pressed={isActive}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-cs-bg4 text-cs-text'
                    : isAvail
                      ? 'text-cs-text3 hover:text-cs-text2 cursor-pointer'
                      : 'text-cs-text3 opacity-40 cursor-not-allowed'
                }`}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cs-green" />}
                <span>{ai.label}</span>
              </button>
            )
          })}
        </div>
        <button onClick={onSettings} className="h-8 px-3 bg-cs-bg3 border border-cs-border text-cs-text2 rounded-md hover:text-cs-text hover:border-cs-border2 transition-colors text-xs font-medium">Settings</button>
        <button onClick={onNewChat} className="h-8 px-3 bg-cs-cyan text-cs-bg text-xs font-semibold rounded-md hover:bg-cs-cyan/90 transition-colors">New session</button>
      </div>
    </header>
  )
}
