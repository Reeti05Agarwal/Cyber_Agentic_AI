"""
CyberSentinel v3.0 - MCP Server
Exposes CyberSentinel's security tools, knowledge base and prompts over the
Model Context Protocol, so any MCP client (the LangGraph agents in app/agents,
Claude Desktop, Cursor, MCP Inspector) can discover and call them.

Transports:
  - Streamable HTTP: mounted inside the FastAPI app at /mcp-server/mcp
  - stdio:           docker exec -i <backend-container> python -m app.mcp_server
"""
import json
from typing import Literal

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

from app.core.agent import execute_tool
from app.services.rag import add_document, get_collection_stats, multi_collection_search

MAX_RESULT_CHARS = 4000

# Tools that send traffic to a target. The agent workflow asks a human to
# approve any plan that uses one of these before it runs.
ACTIVE_TOOLS = {"port_scan", "web_vuln_scan", "web_server_scan"}

PASSIVE = ToolAnnotations(readOnlyHint=True, openWorldHint=True)
ACTIVE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=True)
LOCAL_READ = ToolAnnotations(readOnlyHint=True, openWorldHint=False)

mcp = FastMCP(
    name="CyberSentinel",
    instructions=(
        "Security operations tools. Passive tools (DNS, SSL, WHOIS, headers, threat intel, CVE search, "
        "SIEM queries, knowledge search) are safe to call. Active tools (port_scan, web_vuln_scan, "
        "web_server_scan) send traffic to the target and must only be used on systems you are "
        "authorised to test."
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/mcp",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=["127.0.0.1:*", "localhost:*", "[::1]:*", "backend:*"],
        allowed_origins=["http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*"],
    ),
)


def _compact(result) -> str:
    """Turn a tool result into a short text block that fits a small model's context."""
    if isinstance(result, dict):
        if result.get("output"):
            text = result["output"]
            if result.get("error") and not result.get("success", True):
                text = f"ERROR: {result['error']}\n{text}"
        else:
            text = json.dumps(result, default=str, indent=1)
    else:
        text = str(result)
    if len(text) > MAX_RESULT_CHARS:
        text = text[:MAX_RESULT_CHARS] + f"\n... [truncated, {len(text) - MAX_RESULT_CHARS} more chars]"
    return text


# ── Passive reconnaissance ───────────────────────────

@mcp.tool(title="DNS reconnaissance", annotations=PASSIVE)
async def dns_recon(domain: str) -> str:
    """Look up A, MX, NS and TXT records plus SPF, DMARC and DKIM for a domain."""
    return _compact(await execute_tool("dns_recon", {"target": domain}))


@mcp.tool(title="SSL/TLS check", annotations=PASSIVE)
async def ssl_check(target: str) -> str:
    """Check the SSL/TLS certificate, expiry, supported protocol versions and chain of a domain or host:port."""
    return _compact(await execute_tool("ssl_check", {"target": target}))


@mcp.tool(title="WHOIS lookup", annotations=PASSIVE)
async def whois_lookup(target: str) -> str:
    """Get WHOIS registration details for a domain or IP address."""
    return _compact(await execute_tool("whois_lookup", {"target": target}))


@mcp.tool(title="HTTP security headers", annotations=PASSIVE)
async def http_security_headers(url: str) -> str:
    """Fetch the HTTP response headers of a URL to check security headers such as HSTS, CSP and X-Frame-Options."""
    return _compact(await execute_tool("http_headers", {"target": url}))


@mcp.tool(title="Threat intelligence lookup", annotations=PASSIVE)
async def threat_intel_lookup(indicator: str) -> str:
    """Check an IP, domain or file hash against Shodan, VirusTotal, AbuseIPDB and AlienVault OTX (sources without an API key are skipped)."""
    return _compact(await execute_tool("multi_intel", {"target": indicator}))


@mcp.tool(title="CVE search", annotations=PASSIVE)
async def search_cves(keyword: str) -> str:
    """Search the local NVD CVE database by product or keyword, for example 'apache struts' or 'CVE-2021-44228'."""
    return _compact(await execute_tool("nvd_search", {"target": keyword}))


@mcp.tool(title="SIEM query", annotations=LOCAL_READ)
async def siem_query(
    query_type: Literal["failed_logins", "lateral_movement", "powershell", "alerts"],
    hours: int = 24,
) -> str:
    """Query the Elasticsearch SIEM for security events from the last N hours.

    query_type: failed_logins (Windows 4625, Linux auth failures), lateral_movement (4648, 4624 type 3),
    powershell (script block logging), alerts (high and critical severity).
    """
    tool = {"powershell": "elk_powershell"}.get(query_type, f"elk_{query_type}")
    return _compact(await execute_tool(tool, {"hours": hours}))


# ── Knowledge and memory (RAG) ───────────────────────

@mcp.tool(title="Search security knowledge", annotations=LOCAL_READ)
async def search_security_knowledge(query: str, n_results: int = 4) -> str:
    """Semantic search over the knowledge base: MITRE ATT&CK, CIS, NIST, CVE notes and past agent findings."""
    results = await multi_collection_search(query, n_results=n_results)
    if not results:
        return "No matching knowledge found."
    parts = []
    for r in results:
        meta = r.get("metadata") or {}
        src = meta.get("source", r.get("collection", "kb"))
        parts.append(f"[{src} | score {r.get('score', 0):.2f}]\n{r['text']}")
    return _compact("\n\n---\n\n".join(parts))


@mcp.tool(
    title="Save finding to long-term memory",
    annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False),
)
async def save_finding(target: str, title: str, severity: str, summary: str) -> str:
    """Store an investigation finding in the knowledge base so later investigations can recall it."""
    text = f"Finding on {target}: {title}\nSeverity: {severity}\n{summary}"
    chunks = await add_document(
        text,
        collection_name="user_docs",
        metadata={"source": "agent_finding", "target": target, "severity": severity},
    )
    return f"Saved {chunks} chunk(s) to long-term memory." if chunks else "Could not save the finding."


# ── Active scanning (needs authorisation) ────────────

@mcp.tool(title="Port scan [ACTIVE]", annotations=ACTIVE)
async def port_scan(target: str) -> str:
    """ACTIVE: nmap service scan of the top 100 ports of an IP or domain. Only for targets you are authorised to test."""
    return _compact(await execute_tool("nmap_scan", {"target": target, "options": "-sV --top-ports 100"}))


@mcp.tool(title="Web vulnerability scan [ACTIVE]", annotations=ACTIVE)
async def web_vuln_scan(url: str) -> str:
    """ACTIVE: Nuclei scan for critical and high severity CVEs and misconfigurations. Only for targets you are authorised to test."""
    return _compact(await execute_tool("nuclei_scan", {"target": url}))


@mcp.tool(title="Web server scan [ACTIVE]", annotations=ACTIVE)
async def web_server_scan(url: str) -> str:
    """ACTIVE: Nikto web server scan for outdated software and dangerous files. Only for targets you are authorised to test."""
    return _compact(await execute_tool("nikto_scan", {"target": url}))


# ── Resources ────────────────────────────────────────

@mcp.resource("cybersentinel://policy/rules-of-engagement", title="Rules of engagement", mime_type="text/markdown")
def rules_of_engagement() -> str:
    """Which tools are passive or active, and when active tools may run."""
    active = "\n".join(f"- {t}" for t in sorted(ACTIVE_TOOLS))
    return (
        "# Rules of engagement\n\n"
        "Passive tools only read public records, local data or the knowledge base and may run without approval.\n\n"
        f"Active tools send traffic to the target and need human approval first:\n{active}\n\n"
        "Only test systems you own or have written permission to test, such as testphp.vulnweb.com."
    )


@mcp.resource("cybersentinel://kb/stats", title="Knowledge base statistics", mime_type="application/json")
async def kb_stats() -> str:
    """Document counts per knowledge base collection."""
    return json.dumps(await get_collection_stats(), default=str)


# ── Prompts ──────────────────────────────────────────

@mcp.prompt(title="Domain security assessment")
def domain_assessment(domain: str) -> str:
    """Passive security assessment of a domain."""
    return (
        f"Assess the external security posture of {domain} using passive tools only: dns_recon, ssl_check, "
        "http_security_headers and whois_lookup. Then use search_security_knowledge to map each weakness to "
        "MITRE ATT&CK. Report findings with severity (Critical, High, Medium, Low) and remediation steps."
    )


@mcp.prompt(title="Incident triage")
def incident_triage(alert: str) -> str:
    """Triage a security alert against SIEM data and the knowledge base."""
    return (
        f"Triage this security alert: {alert}\n"
        "1. Query the SIEM (siem_query) for related failed logins, lateral movement and PowerShell activity.\n"
        "2. Check any IPs or hashes with threat_intel_lookup.\n"
        "3. Use search_security_knowledge to identify the MITRE ATT&CK technique.\n"
        "4. Decide if it is a true positive, give severity, and list containment steps."
    )


if __name__ == "__main__":
    mcp.run("stdio")
