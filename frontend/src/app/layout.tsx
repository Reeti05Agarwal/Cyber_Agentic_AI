import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cyber Agentic AI - Multi-Agent Security Platform with MCP',
  description: 'Multi-agent security investigations with MCP tools and a local LLM, Docker-powered.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
