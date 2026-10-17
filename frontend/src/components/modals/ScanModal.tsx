'use client'
import { useState } from 'react'
import { runScan } from '@/lib/api'

const SCAN_TYPES = [
  { id: 'ping', label: 'Ping', test: '8.8.8.8' },
  { id: 'nmap', label: 'Nmap', test: 'scanme.nmap.org' },
  { id: 'dns', label: 'DNS Recon', test: 'google.com' },
  { id: 'ssl', label: 'SSL Check', test: 'google.com' },
  { id: 'whois', label: 'WHOIS', test: 'google.com' },
  { id: 'headers', label: 'HTTP Headers', test: 'https://example.com' },
  { id: 'traceroute', label: 'Traceroute', test: '8.8.8.8' },
  { id: 'subfinder', label: 'Subdomains', test: 'hackerone.com' },
  { id: 'nikto', label: 'Nikto', test: 'http://testphp.vulnweb.com' },
  { id: 'nuclei', label: 'Nuclei', test: 'http://testphp.vulnweb.com' },
  { id: 'sqlmap', label: 'SQLMap', test: 'http://testphp.vulnweb.com/listproducts.php?cat=1' },
  { id: 'zap', label: 'OWASP ZAP', test: 'http://testphp.vulnweb.com' },
]

interface ScanModalProps {
  onScanResult: (userMsg: string, resultMsg: string, badge: string) => void
  onClose: () => void
}

export default function ScanModal({ onScanResult, onClose }: ScanModalProps) {
  const [target, setTarget] = useState('')
  const [scanType, setScanType] = useState('ping')
  const [scanning, setScanning] = useState(false)
  const [timer, setTimer] = useState(0)

  const handleScan = async () => {
    if (!target.trim() || scanning) return
    setScanning(true)
    setTimer(0)
    const timerInt = setInterval(() => setTimer(p => p + 1), 1000)
    const userMsg = `Run ${scanType} scan on ${target}`
    try {
      const r = await runScan(target, scanType)
      const output = r.output || r.error || 'No output received'
      const resultMsg = `**${scanType.toUpperCase()} scan: ${target}**\nDuration: ${r.duration || 0}s | Exit: ${r.exit_code ?? '?'}\n\n\`\`\`\n${output}\n\`\`\``
      onScanResult(userMsg, resultMsg, scanType.toUpperCase())
    } catch (e: any) {
      onScanResult(userMsg, `Scan error: ${e.message}`, scanType.toUpperCase())
    }
    clearInterval(timerInt)
    setTimer(0)
    setScanning(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-cs-bg2 border border-cs-border rounded-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Live security scan</h2>
          <button onClick={onClose} className="text-xs text-cs-text2 border border-cs-border rounded px-2 py-0.5 hover:text-cs-text hover:border-cs-border2">Close</button>
        </div>
        <div className="mb-3">
          <label className="text-xs text-cs-text2 mb-1 block">Target (IP, domain, or URL)</label>
          <input type="text" placeholder="e.g., google.com or 8.8.8.8" value={target} onChange={e => setTarget(e.target.value)} className="w-full bg-cs-bg3 border border-cs-border text-cs-text rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-cs-border2" onKeyDown={e => { if (e.key === 'Enter') handleScan() }} />
        </div>
        <div className="mb-3">
          <label className="text-xs text-cs-text2 mb-1 block">Scan type</label>
          <div className="grid grid-cols-2 gap-2">
            {SCAN_TYPES.map(s => (
              <button key={s.id} onClick={() => { setScanType(s.id); setTarget(s.test) }} className={`text-left px-3 py-2 rounded-md border text-xs transition-colors ${scanType === s.id ? 'bg-cs-bg4 border-cs-border2 text-cs-text' : 'bg-cs-bg3 border-cs-border text-cs-text2 hover:border-cs-border2'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-cs-bg3 border border-cs-border rounded-md px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-xs text-cs-text3">Target</span>
          <span className="text-xs text-cs-text font-mono">{target || 'select a scan type'}</span>
        </div>
        <button onClick={handleScan} disabled={scanning || !target.trim()} className="w-full bg-cs-cyan text-cs-bg py-2 rounded-md text-sm font-semibold hover:bg-cs-cyan/90 disabled:opacity-50">
          {scanning ? `Scanning... ${timer}s` : 'Run scan'}
        </button>
        {scanning && (
          <div className="mt-2">
            <div className="h-1 bg-cs-bg4 rounded-full overflow-hidden">
              <div className="h-full bg-cs-cyan rounded-full transition-all duration-1000" style={{ width: `${Math.min(timer / 120 * 100, 95)}%` }} />
            </div>
          </div>
        )}
        <div className="text-xs text-cs-text3 mt-2">Runs in an isolated Kali sandbox container.</div>
        <div className="mt-3 bg-cs-bg border border-cs-border rounded-md p-3">
          <div className="text-xs text-cs-orange font-medium mb-1">Authorized use only</div>
          <div className="text-xs text-cs-text3 leading-relaxed">These scanning tools are provided <span className="text-cs-text2">strictly for educational purposes, authorized penetration testing, and security research</span>. By executing a scan you confirm: (1) You own the target or have <span className="text-cs-text2">explicit written authorization</span> from the owner to test it. (2) You are conducting a lawful security assessment. (3) You accept full responsibility for any scans executed. Use the provided test targets (testphp.vulnweb.com, scanme.nmap.org) for safe, legal practice.</div>
        </div>
      </div>
    </div>
  )
}
