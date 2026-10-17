'use client'

interface WelcomeScreenProps {
  toolCount: number
  onSend: (text: string) => void
  onOpenScan: () => void
}

const QUICK_ACTIONS = [
  { title: 'Full domain scan', desc: 'Nmap, SSL, DNS and HTTP headers on one target', q: 'Scan scanme.nmap.org - run nmap, ssl check, dns recon, and http headers', scan: false },
  { title: 'Threat intel lookup', desc: 'Shodan, VirusTotal, AbuseIPDB and OTX for an indicator', q: 'Look up 8.8.8.8 on all threat intel sources', scan: false },
  { title: 'Compliance check', desc: 'CIS v8, FedRAMP, HIPAA, PCI-DSS, SOC 2', q: 'Assess ALL compliance frameworks for access control and encryption', scan: false },
  { title: 'SQL injection test', desc: 'sqlmap against a URL with parameters', q: 'Run sqlmap against http://testphp.vulnweb.com/listproducts.php?cat=1', scan: false },
  { title: 'Vulnerability scan', desc: 'Nuclei and Nikto, opens the scanner', q: '', scan: true },
  { title: 'Detection rules', desc: 'Sigma, YARA and Snort rules from a description', q: 'Generate Sigma + YARA + Snort rules for detecting Cobalt Strike', scan: false },
]

export default function WelcomeScreen({ toolCount, onSend, onOpenScan }: WelcomeScreenProps) {
  return (
    <div className="py-12 animate-slide-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-cs-text mb-1">Cyber Agentic AI</h1>
      <p className="text-sm text-cs-text2 mb-1">
        Security assistant with {toolCount} tools: scanners, threat intelligence, SIEM queries and a knowledge base.
      </p>
      <p className="text-xs text-cs-text3 mb-8">Built on the open-source CyberSentinel AI platform.</p>
      <div className="text-xs font-medium text-cs-text3 mb-2">Start with</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((b, i) => (
          <button
            key={i}
            onClick={() => b.scan ? onOpenScan() : onSend(b.q)}
            className="rounded-lg p-3 text-left bg-cs-bg2 border border-cs-border hover:border-cs-border2 hover:bg-cs-bg3 transition-colors"
          >
            <div className="font-medium text-sm text-cs-text">{b.title}</div>
            <div className="text-xs text-cs-text3 mt-0.5">{b.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
