'use client'
import { fmtMsg, type Badge } from '@/lib/utils'

export interface DisplayMessage {
  role: string
  content: string
  badges?: Badge[]
}

interface ChatMessagesProps {
  msgs: DisplayMessage[]
  streaming: boolean
  streamText: string
  streamTimer: number
  copied: number | null
  onCopy: (content: string, idx: number) => void
  onStop: () => void
  chatEndRef: React.RefObject<HTMLDivElement>
}

export default function ChatMessages({ msgs, streaming, streamText, streamTimer, copied, onCopy, onStop, chatEndRef }: ChatMessagesProps) {
  return (
    <>
      {msgs.map((msg, i) => (
        <div key={i} className="flex gap-3 my-3 animate-slide-in group/msg">
          <div className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[0.7rem] font-semibold border ${msg.role === 'user' ? 'bg-cs-bg3 border-cs-border text-cs-text2' : 'bg-cs-bg4 border-cs-border2 text-cs-text'}`}>
            {msg.role === 'user' ? 'You' : 'CS'}
          </div>
          <div className={`border rounded-lg px-4 py-3 max-w-[85%] text-sm leading-relaxed relative ${msg.role === 'user' ? 'bg-cs-bg3 border-cs-border' : 'bg-cs-bg2 border-cs-border'}`}>
            <div className="chat-content select-text" dangerouslySetInnerHTML={{ __html: fmtMsg(msg.content) }} />
            {msg.badges && msg.badges.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {msg.badges.map((b, j) => (
                  <span key={j} className={`text-[0.7rem] px-2 py-0.5 rounded border font-medium ${b.cls}`}>{b.name}</span>
                ))}
              </div>
            )}
            <button
              onClick={() => onCopy(msg.content, i)}
              className={`absolute top-2 right-2 h-6 px-2 rounded border text-[0.7rem] font-medium flex items-center justify-center transition-opacity ${copied === i ? 'bg-cs-bg3 border-cs-border text-cs-green' : 'bg-cs-bg3 border-cs-border text-cs-text3 hover:text-cs-text'} opacity-0 group-hover/msg:opacity-100 focus:opacity-100`}
              title="Copy"
            >
              {copied === i ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      ))}

      {streaming && (
        <div className="flex gap-3 my-3 animate-slide-in">
          <div className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[0.7rem] font-semibold border bg-cs-bg4 border-cs-border2 text-cs-text">CS</div>
          <div className="bg-cs-bg2 border border-cs-border rounded-lg px-4 py-3 max-w-[85%] text-sm leading-relaxed w-full">
            {streamText ? (
              <div className="chat-content select-text" dangerouslySetInnerHTML={{ __html: fmtMsg(streamText) }} />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cs-text3 animate-[typing_1.4s_infinite]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cs-text3 animate-[typing_1.4s_infinite_0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cs-text3 animate-[typing_1.4s_infinite_0.4s]" />
                </div>
                <span className="text-xs text-cs-text3">
                  {streamTimer > 0 ? `Working... ${streamTimer}s` : 'Connecting...'}
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-cs-bg4 rounded-full overflow-hidden">
                <div className="h-full bg-cs-cyan rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(streamTimer / 90 * 100, 95)}%` }} />
              </div>
              <span className="text-xs text-cs-text3 tabular-nums shrink-0">{streamTimer}s</span>
              <button onClick={onStop} className="text-xs text-cs-text2 border border-cs-border rounded px-2 py-0.5 hover:text-cs-red hover:border-cs-red/50 shrink-0">Stop</button>
            </div>
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </>
  )
}
