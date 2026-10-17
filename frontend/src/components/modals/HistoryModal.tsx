'use client'

interface HistoryModalProps {
  conversations: any[]
  onLoadChat: (id: string) => void
  onNewChat: () => void
  onClose: () => void
}

export default function HistoryModal({ conversations, onLoadChat, onNewChat, onClose }: HistoryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex" onClick={onClose}>
      <div className="w-80 bg-cs-bg2 border-r border-cs-border h-full overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">History</h2>
          <button onClick={onClose} className="text-xs text-cs-text2 border border-cs-border rounded px-2 py-0.5 hover:text-cs-text hover:border-cs-border2">Close</button>
        </div>
        <button onClick={() => { onNewChat(); onClose() }} className="w-full bg-cs-cyan text-cs-bg text-xs font-semibold py-2 rounded-md mb-3 hover:bg-cs-cyan/90">New session</button>
        {conversations.length === 0 ? (
          <div className="text-cs-text3 text-xs py-4">No conversations yet.</div>
        ) : (
          conversations.map((c: any) => (
            <div key={c.id} className="bg-cs-bg3 border border-cs-border rounded-md p-3 mb-2 cursor-pointer hover:border-cs-border2 transition-colors" onClick={() => onLoadChat(c.id)}>
              <div className="text-sm text-cs-text truncate">{c.title}</div>
              <div className="text-xs text-cs-text3 mt-1">{c.message_count} messages · {c.provider}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
