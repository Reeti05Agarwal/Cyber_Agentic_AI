'use client'
import { type Tool } from '@/lib/api'
import { CAT_LABELS, CAT_BG } from '@/lib/utils'

interface SidebarProps {
  tools: Tool[]
  activeTool: string | null
  mobSidebar: boolean
  onPickTool: (name: string) => void
  onOpenScan: () => void
  onCloseMobile: () => void
}

export default function Sidebar({ tools, activeTool, mobSidebar, onPickTool, onOpenScan, onCloseMobile }: SidebarProps) {
  const grouped: Record<string, Tool[]> = {}
  tools.forEach(t => {
    if (!grouped[t.cat]) grouped[t.cat] = []
    grouped[t.cat].push(t)
  })

  return (
    <aside className={`bg-cs-bg2 border-r border-cs-border overflow-y-auto py-1 ${mobSidebar ? 'fixed inset-y-14 left-0 w-72 z-50 block shadow-xl' : 'hidden md:block'}`}>
      {Object.entries(grouped).map(([cat, catTools]) => (
        <div key={cat} className="mb-1">
          <div
            onClick={() => cat === 'scan' ? onOpenScan() : undefined}
            className={`flex items-center justify-between mx-2 mt-3 mb-1 px-2 py-1 ${CAT_BG[cat] || ''} ${cat === 'scan' ? 'cursor-pointer hover:text-cs-text' : ''}`}
          >
            <span className="text-xs font-medium text-cs-text3">{CAT_LABELS[cat] || cat}</span>
            <span className="text-[0.7rem] text-cs-text3 tabular-nums">{catTools.length}</span>
          </div>
          {catTools.map(tool => (
            <div
              key={tool.id}
              onClick={() => { onPickTool(tool.name); onCloseMobile() }}
              className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer text-[0.85rem] transition-colors truncate ${activeTool === tool.name ? 'bg-cs-bg4 text-cs-text' : 'text-cs-text2 hover:bg-cs-bg3 hover:text-cs-text'}`}
            >
                            <span className="truncate">{tool.name}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2 px-3 py-2 mt-2 border-t border-cs-border text-xs text-cs-text3">
        <strong className="text-cs-text font-semibold">{tools.length}</strong> tools across <strong>{Object.keys(grouped).length}</strong> categories
      </div>
      <div className="px-3 pb-3 text-[0.7rem] text-cs-text3">CyberSentinel AI v3.0 | Agentic</div>
    </aside>
  )
}
