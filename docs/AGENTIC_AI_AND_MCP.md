# Agentic AI and MCP

CyberSentinel exposes its security tools through an MCP server, and a LangGraph team of agents uses those tools to investigate a goal.

```
guardrail -> planner -> approval (human) -> investigator <-> MCP tools -> reporter
```

| Part | File | What it does |
| --- | --- | --- |
| MCP server | `backend/app/mcp_server.py` | 12 tools, 2 resources and 2 prompts over Streamable HTTP and stdio |
| Agent workflow | `backend/app/agents/workflow.py` | Planner, approval, investigator (ReAct loop) and reporter agents in one LangGraph state graph |
| API | `backend/app/routers/agents.py` | Start, approve and inspect investigations |
| Evaluation | `backend/app/agents/evaluate.py` | Scores tool selection, approval gating, guardrails, latency and tokens |

## Using your own Ollama instead of the Docker one

1. Make the host Ollama reachable from containers (by default it only listens on 127.0.0.1):

   ```bash
   sudo systemctl edit ollama
   ```

   Add these lines, save, then restart it:

   ```ini
   [Service]
   Environment="OLLAMA_HOST=0.0.0.0:11434"
   ```

   ```bash
   sudo systemctl restart ollama
   ```

   This also exposes port 11434 to your local network; block it in your firewall if that matters.

2. Pull the model on the host: `ollama pull qwen2.5:7b` (or set `OLLAMA_MODEL` in `.env` to a model you already have that supports tool calling, such as `llama3.1` or `qwen2.5`).

3. In `.env`, switch to option B:

   ```ini
   COMPOSE_PROFILES=
   OLLAMA_BASE_URL=http://host.docker.internal:11434
   ```

4. Start the stack: `docker compose up -d --build`. The `ollama` and `ollama-init` containers are skipped.

Check the backend can reach it: `docker compose exec backend curl -s http://host.docker.internal:11434/api/tags`.

## MCP server

Endpoint: `http://localhost:8000/mcp-server/mcp` (Streamable HTTP, stateless, JSON responses).

| Tool | Type | Wraps |
| --- | --- | --- |
| `dns_recon`, `ssl_check`, `whois_lookup`, `http_security_headers` | Passive | Sandbox recon commands |
| `threat_intel_lookup` | Passive | Shodan, VirusTotal, AbuseIPDB, OTX (keys optional) |
| `search_cves` | Passive | Local NVD database |
| `siem_query` | Passive | Elasticsearch SIEM |
| `search_security_knowledge` | Passive | ChromaDB RAG (MITRE, NIST, CIS, past findings) |
| `save_finding` | Memory write | Stores a report in ChromaDB |
| `port_scan`, `web_vuln_scan`, `web_server_scan` | Active, needs approval | nmap, Nuclei, Nikto |

Resources: `cybersentinel://policy/rules-of-engagement`, `cybersentinel://kb/stats`.
Prompts: `domain_assessment`, `incident_triage`.

Each tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) so clients can tell passive tools from active ones.

### Inspect it with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Choose transport "Streamable HTTP" and URL `http://localhost:8000/mcp-server/mcp`.

### Use it from Claude Desktop or Cursor (stdio)

```json
{
  "mcpServers": {
    "cybersentinel": {
      "command": "docker",
      "args": ["exec", "-i", "<backend container name>", "python", "-m", "app.mcp_server"]
    }
  }
}
```

Find the container name with `docker compose ps backend`.

## Running an investigation

Open `http://localhost:8000/docs` and use the `agents` endpoints, or:

```bash
curl -s -X POST localhost:8000/api/agents/investigate -H 'Content-Type: application/json' -d '{"goal":"Check DNS, SSL and security headers for example.com"}'
```

A goal that needs an active scan stops with `"status": "awaiting_approval"`. Approve or reject it:

```bash
curl -s -X POST localhost:8000/api/agents/<thread_id>/approve -H 'Content-Type: application/json' -d '{"approved": true}'
```

`GET /api/agents/tools` lists the tools the agents discovered over MCP.

## Evaluation

```bash
docker compose exec backend python -m app.agents.evaluate
```

Runs 10 goals (passive, active and a prompt-injection attempt), rejects every approval request so no active scan runs, and writes `/app/data/agent_eval.json` with tool precision and recall, approval and guardrail accuracy, latency, tokens and tool error rate.
