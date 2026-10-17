'use client'

interface CveDetailModalProps {
  cve: any
  onClose: () => void
}

export default function CveDetailModal({ cve, onClose }: CveDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-cs-bg2 border border-cs-border rounded-lg w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold font-mono">{cve.cve_id}</h2>
          <button onClick={onClose} className="text-xs text-cs-text2 border border-cs-border rounded px-2 py-0.5 hover:text-cs-text hover:border-cs-border2">Close</button>
        </div>
        <div className="flex gap-2 mb-4">
          <span className="text-xs px-2 py-1 rounded border border-cs-border text-cs-text2 tabular-nums">
            CVSS {cve.cvss_score}
          </span>
          <span className={`text-xs px-2 py-1 rounded border border-cs-border font-medium ${cve.cvss_score >= 9 ? 'text-cs-red' : cve.cvss_score >= 7 ? 'text-cs-orange' : cve.cvss_score >= 4 ? 'text-cs-yellow' : 'text-cs-green'}`}>
            {cve.cvss_score >= 9 ? 'Critical' : cve.cvss_score >= 7 ? 'High' : cve.cvss_score >= 4 ? 'Medium' : 'Low'}
          </span>
        </div>
        <div className="mb-4">
          <div className="text-xs text-cs-text3 mb-1 font-medium">Description</div>
          <div className="text-sm text-cs-text leading-relaxed">{cve.description || 'No description available.'}</div>
        </div>
        <div className="mb-4">
          <div className="text-xs text-cs-text3 mb-1 font-medium">How to protect</div>
          <div className="text-sm text-cs-text2 leading-relaxed space-y-1">
            {cve.cvss_score >= 9 ? (
              <>
                <p>• <strong>Patch immediately</strong> - this is a critical vulnerability actively being targeted.</p>
                <p>• Apply vendor security updates or virtual patching via WAF/IPS rules.</p>
                <p>• Isolate affected systems until patched. Monitor for exploitation indicators.</p>
                <p>• Check CISA KEV catalog for known exploitation status.</p>
              </>
            ) : cve.cvss_score >= 7 ? (
              <>
                <p>• <strong>Prioritize patching</strong> within your next maintenance window.</p>
                <p>• Apply compensating controls (network segmentation, access restrictions).</p>
                <p>• Monitor logs for exploitation attempts targeting this CVE.</p>
                <p>• Review vendor advisory for specific mitigation guidance.</p>
              </>
            ) : (
              <>
                <p>• Schedule patching during normal maintenance cycles.</p>
                <p>• Apply defense-in-depth controls as compensating measures.</p>
                <p>• Monitor for any escalation in exploitation activity via EPSS scores.</p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`https://nvd.nist.gov/vuln/detail/${cve.cve_id}`} target="_blank" rel="noreferrer" className="flex-1 text-center bg-cs-bg3 border border-cs-border text-cs-text2 py-2 rounded-md text-sm hover:text-cs-text hover:border-cs-border2">NVD entry</a>
          <a href={`https://www.cvedetails.com/cve/${cve.cve_id}`} target="_blank" rel="noreferrer" className="flex-1 text-center bg-cs-bg3 border border-cs-border text-cs-text2 py-2 rounded-md text-sm hover:text-cs-text hover:border-cs-border2">CVE Details</a>
        </div>
      </div>
    </div>
  )
}
