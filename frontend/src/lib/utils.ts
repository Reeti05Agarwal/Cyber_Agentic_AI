/**
 * CyberSentinel v3.0 - Shared utilities and constants
 */

// Category display labels
export const CAT_LABELS: Record<string, string> = {
  scan: 'Live scanners',
  intel: 'Threat intel APIs',
  siem: 'SIEM',
  detect: 'Detection and analysis',
  rule: 'Threat hunting and rules',
  framework: 'Frameworks and compliance',
}

export const CAT_COLORS: Record<string, string> = {
  scan: 'border-l-cs-border2',
  intel: 'border-l-cs-border2',
  siem: 'border-l-cs-border2',
  detect: 'border-l-cs-border2',
  rule: 'border-l-cs-border2',
  framework: 'border-l-cs-border2',
}

export const CAT_BG: Record<string, string> = {
  scan: '',
  intel: '',
  siem: '',
  detect: '',
  rule: '',
  framework: '',
}

export interface Badge {
  name: string
  cls: string
}

/** Detect context badges from a message */
export function detectBadges(t: string): Badge[] {
  const l = t.toLowerCase()
  const o: Badge[] = []
  const m = [
    { k: ['threat hunt', 'sweep'], n: 'Threat Hunt', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['siem', 'splunk', 'elastic'], n: 'SIEM', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['mitre', 'att&ck'], n: 'MITRE', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['yara'], n: 'YARA', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['sigma'], n: 'Sigma', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['nmap'], n: 'Nmap', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['ssl', 'tls'], n: 'SSL/TLS', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['dns'], n: 'DNS', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['compliance', 'nist', 'hipaa', 'pci'], n: 'Compliance', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['cve', 'cvss', 'vuln'], n: 'Vuln', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['incident'], n: 'IR', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
    { k: ['cloud', 'aws', 'azure'], n: 'Cloud', c: 'bg-cs-bg3 text-cs-text2 border-cs-border' },
  ]
  for (const i of m) {
    if (i.k.some(k => l.includes(k))) o.push({ name: i.n, cls: i.c })
  }
  return o.slice(0, 4)
}

/** Escape HTML entities */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Format a message with markdown-like syntax to HTML */
export function fmtMsg(t: string): string {
  const cb: string[] = []
  let s = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => {
    const i = cb.length
    cb.push(
      `<div class="relative my-2 rounded-lg overflow-hidden border border-cs-border"><pre class="bg-cs-bg p-3 overflow-x-auto font-mono text-[0.8rem] leading-relaxed text-cs-text whitespace-pre-wrap ${l ? 'pt-7' : ''}">${l ? `<span class="text-[0.7rem] text-cs-text3 bg-cs-border2 px-2 py-0.5 rounded-br font-mono uppercase absolute top-0 left-0">${escHtml(l)}</span>` : ''}${escHtml(c.trim())}</pre></div>`
    )
    return `%%CB${i}%%`
  })

  const ic: string[] = []
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    const i = ic.length
    ic.push(`<code class="bg-cs-bg4 px-1.5 py-0.5 rounded text-cs-text font-mono text-[0.8rem]">${escHtml(c)}</code>`)
    return `%%IC${i}%%`
  })

  const lk: string[] = []
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, text, url) => {
    const i = lk.length
    lk.push(`<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-cs-cyan hover:text-cs-text underline underline-offset-2">${escHtml(text)}</a>`)
    return `%%LK${i}%%`
  })

  s = escHtml(s)
  cb.forEach((b, i) => { s = s.replace(`%%CB${i}%%`, b) })
  ic.forEach((c, i) => { s = s.replace(`%%IC${i}%%`, c) })
  lk.forEach((l, i) => { s = s.replace(`%%LK${i}%%`, l) })

  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>')
    .replace(/\n/g, '<br/>')
}
