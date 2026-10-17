"""
CyberSentinel v3.0 - Multi-Agent Investigation Workflow (LangGraph + MCP)

A team of agents shares one LangGraph state graph:

  guardrail -> planner -> approval (human-in-the-loop) -> investigator <-> tools -> reporter

- Planner:      decomposes the goal into tool steps (structured JSON output)
- Approval:     pauses the graph with interrupt() when the plan contains active scans
- Investigator: ReAct loop - reasons, calls tools, reads results, decides the next call
- Reporter:     writes the final report grounded in tool evidence + RAG, then stores it
                in long-term memory

Every tool is discovered and called over MCP (app.mcp_server), not imported directly.
Short-term memory is the LangGraph checkpointer (state survives the approval pause);
long-term memory is the ChromaDB knowledge base (save_finding / search_security_knowledge).
"""
import asyncio
import operator
import os
import time
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.guardrails import scan_input, scan_output
from app.mcp_server import ACTIVE_TOOLS

MCP_URL = os.environ.get("MCP_SERVER_URL", "http://localhost:8000/mcp-server/mcp")
MAX_TOOL_ROUNDS = 6
MAX_EVIDENCE_CHARS = 12000
SEVERITIES = ("Critical", "High", "Medium", "Low")


# ── Shared state ─────────────────────────────────────

class InvestigationState(TypedDict, total=False):
    goal: str
    status: str
    plan: list[dict]
    approved: bool
    rounds: int
    messages: Annotated[list[BaseMessage], add_messages]
    tool_trace: Annotated[list[dict], operator.add]
    metrics: Annotated[list[dict], operator.add]
    report: str


class PlanStep(BaseModel):
    tool: str = Field(description="Exact name of one available tool")
    target: str = Field(description="Domain, IP, URL, indicator or search query the tool runs on")
    reason: str = Field(description="Why this step helps reach the goal")


class Plan(BaseModel):
    steps: list[PlanStep] = Field(description="1 to 5 ordered steps")


# ── Prompts ──────────────────────────────────────────

PLANNER_PROMPT = """You are the Planner agent in a security operations team.
Break the user's goal into 1 to 5 tool steps. Use only these tools:
{catalog}

Rules:
- Prefer passive tools. Use an [ACTIVE] tool only when the goal explicitly asks to scan, probe or test a target.
- Use search_security_knowledge when the goal asks about an attack technique, a framework or past findings.
- Use siem_query when the goal is about logs, logins, alerts or suspicious activity inside the network.
- Copy the exact domain, IP, URL or indicator from the goal into target. Never invent a target."""

INVESTIGATOR_PROMPT = """You are the Investigator agent in a security operations team.
Carry out the plan by calling tools. Read every result before deciding the next call.
You may add a step if a result shows something worth checking, or skip a step that is no longer useful.
When you have enough evidence, stop calling tools and reply with a short plain-text summary of what each tool found.
Never invent tool output."""

REPORTER_PROMPT = """You are the Reporter agent in a security operations team.
Write a concise security report in Markdown using ONLY the evidence and knowledge-base context provided.
Sections:
## Summary
## Findings - each finding with a severity (Critical, High, Medium or Low) and a MITRE ATT&CK technique ID when one applies
## Recommendations
If a tool failed or the evidence is thin, say so. Never invent results."""


# ── Helpers ──────────────────────────────────────────

def _llm() -> ChatOllama:
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=0,
        num_ctx=8192,
    )


def _text(content) -> str:
    """MCP tool results arrive as a string or a list of content blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in content)
    return str(content)


def _metric(node: str, start: float, message: BaseMessage | None = None) -> dict:
    usage = (getattr(message, "usage_metadata", None) or {}) if message is not None else {}
    return {
        "node": node,
        "seconds": round(time.perf_counter() - start, 2),
        "llm_call": message is not None,
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
    }


def _severity(report: str) -> str:
    return next((s for s in SEVERITIES if s.lower() in report.lower()), "Info")


# ── Graph ────────────────────────────────────────────

async def load_mcp_tools():
    """Discover the tools exposed by the CyberSentinel MCP server."""
    connection = {"transport": "streamable_http", "url": MCP_URL}
    if settings.cybersentinel_api_key:
        connection["headers"] = {"x-api-key": settings.cybersentinel_api_key}
    client = MultiServerMCPClient({"cybersentinel": connection})
    return await client.get_tools()


async def build_graph():
    tools = await load_mcp_tools()
    tools_by_name = {t.name: t for t in tools}
    agent_tools = [t for t in tools if t.name != "save_finding"]
    catalog = "\n".join(
        f"- {t.name}{' [ACTIVE]' if t.name in ACTIVE_TOOLS else ''}: {(t.description or '').strip().splitlines()[0]}"
        for t in agent_tools
    )

    async def guardrail(state: InvestigationState) -> dict:
        start = time.perf_counter()
        check = scan_input(state["goal"])
        if check["blocked"]:
            return {
                "status": "blocked",
                "report": f"Request blocked by the input guardrail: {check['block_reason']}",
                "metrics": [_metric("guardrail", start)],
            }
        return {"status": "planning", "metrics": [_metric("guardrail", start)]}

    async def planner(state: InvestigationState) -> dict:
        start = time.perf_counter()
        llm = _llm().with_structured_output(Plan, include_raw=True)
        out = await llm.ainvoke([
            SystemMessage(PLANNER_PROMPT.format(catalog=catalog)),
            HumanMessage(state["goal"]),
        ])
        parsed: Plan | None = out.get("parsed")
        steps = [s.model_dump() for s in (parsed.steps if parsed else []) if s.tool in tools_by_name][:5]
        if not steps:
            steps = [{"tool": "search_security_knowledge", "target": state["goal"], "reason": "Fallback: the plan could not be parsed"}]
        return {"plan": steps, "rounds": 0, "status": "planned", "metrics": [_metric("planner", start, out.get("raw"))]}

    async def approval(state: InvestigationState) -> dict:
        active = [s for s in state["plan"] if s["tool"] in ACTIVE_TOOLS]
        if not active:
            return {"approved": True}
        decision = interrupt({
            "question": "The plan includes active scans that send traffic to the target. Approve?",
            "active_steps": active,
        })
        approved = bool(decision.get("approved")) if isinstance(decision, dict) else bool(decision)
        return {"approved": approved}

    async def investigator(state: InvestigationState) -> dict:
        start = time.perf_counter()
        rounds = state.get("rounds", 0)
        new_messages: list[BaseMessage] = []
        if rounds == 0:
            plan_text = "\n".join(f"{i + 1}. {s['tool']}({s['target']}): {s['reason']}" for i, s in enumerate(state["plan"]))
            note = "" if state.get("approved") else "\nThe human reviewer did NOT approve active scans. Use passive tools only."
            new_messages.append(HumanMessage(f"Goal: {state['goal']}\n\nPlan:\n{plan_text}{note}"))

        allowed = [t for t in agent_tools if state.get("approved") or t.name not in ACTIVE_TOOLS]
        llm = _llm() if rounds >= MAX_TOOL_ROUNDS else _llm().bind_tools(allowed)
        history = list(state.get("messages", [])) + new_messages
        response = await llm.ainvoke([SystemMessage(INVESTIGATOR_PROMPT)] + history)
        return {
            "messages": new_messages + [response],
            "rounds": rounds + 1,
            "status": "investigating",
            "metrics": [_metric("investigator", start, response)],
        }

    async def run_tools(state: InvestigationState) -> dict:
        last = state["messages"][-1]
        results, trace = [], []
        for call in last.tool_calls:
            name, args = call["name"], call["args"]
            start = time.perf_counter()
            if name not in tools_by_name or name == "save_finding":
                result, ok = f"Unknown tool: {name}", False
            elif name in ACTIVE_TOOLS and not state.get("approved"):
                result, ok = "Denied: the human reviewer did not approve active scans.", False
            else:
                try:
                    result, ok = _text(await tools_by_name[name].ainvoke(args)), True
                except Exception as e:
                    result, ok = f"Tool error: {e}", False
            results.append(ToolMessage(content=result, tool_call_id=call["id"], name=name))
            trace.append({"tool": name, "args": args, "ok": ok, "seconds": round(time.perf_counter() - start, 2)})
        return {"messages": results, "tool_trace": trace}

    async def reporter(state: InvestigationState) -> dict:
        start = time.perf_counter()
        messages = state.get("messages", [])
        evidence = "\n\n".join(f"### {m.name}\n{_text(m.content)}" for m in messages if isinstance(m, ToolMessage))
        summary = next((_text(m.content) for m in reversed(messages) if isinstance(m, AIMessage)), "")
        try:
            kb = _text(await tools_by_name["search_security_knowledge"].ainvoke({"query": state["goal"], "n_results": 3}))
        except Exception:
            kb = "Knowledge base unavailable."

        response = await _llm().ainvoke([
            SystemMessage(REPORTER_PROMPT),
            HumanMessage(
                f"Goal: {state['goal']}\n\nInvestigator summary:\n{summary}\n\n"
                f"Tool evidence:\n{evidence[:MAX_EVIDENCE_CHARS] or 'No tools were run.'}\n\n"
                f"Knowledge base context:\n{kb}"
            ),
        ])
        report = _text(response.content)
        check = scan_output(report)
        if not check["safe"]:
            report = check["redacted"]
        else:
            targets = ", ".join(sorted({s["target"] for s in state.get("plan", [])}))[:200] or "n/a"
            try:
                await tools_by_name["save_finding"].ainvoke({
                    "target": targets,
                    "title": state["goal"][:120],
                    "severity": _severity(report),
                    "summary": report[:1500],
                })
            except Exception:
                pass
        return {"report": report, "status": "completed", "metrics": [_metric("reporter", start, response)]}

    def after_guardrail(state: InvestigationState) -> str:
        return END if state.get("status") == "blocked" else "planner"

    def after_investigator(state: InvestigationState) -> str:
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls and state.get("rounds", 0) <= MAX_TOOL_ROUNDS:
            return "tools"
        return "reporter"

    graph = StateGraph(InvestigationState)
    graph.add_node("guardrail", guardrail)
    graph.add_node("planner", planner)
    graph.add_node("approval", approval)
    graph.add_node("investigator", investigator)
    graph.add_node("tools", run_tools)
    graph.add_node("reporter", reporter)

    graph.add_edge(START, "guardrail")
    graph.add_conditional_edges("guardrail", after_guardrail, ["planner", END])
    graph.add_edge("planner", "approval")
    graph.add_edge("approval", "investigator")
    graph.add_conditional_edges("investigator", after_investigator, ["tools", "reporter"])
    graph.add_edge("tools", "investigator")
    graph.add_edge("reporter", END)
    return graph.compile(checkpointer=InMemorySaver())


_graph = None
_graph_lock = asyncio.Lock()


async def get_graph():
    """Build the graph once, after the MCP server is reachable."""
    global _graph
    async with _graph_lock:
        if _graph is None:
            _graph = await build_graph()
    return _graph


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}, "recursion_limit": 40}


async def _snapshot(graph, thread_id: str) -> dict:
    snap = await graph.aget_state(_config(thread_id))
    values = snap.values or {}
    pending = [i.value for i in snap.interrupts]
    metrics = values.get("metrics", [])
    trace = values.get("tool_trace", [])
    return {
        "thread_id": thread_id,
        "status": "awaiting_approval" if pending else values.get("status"),
        "goal": values.get("goal"),
        "plan": values.get("plan", []),
        "approved": values.get("approved"),
        "pending_approval": pending[0] if pending else None,
        "report": values.get("report"),
        "tool_trace": trace,
        "metrics": {
            "total_seconds": round(sum(m["seconds"] for m in metrics) + sum(t["seconds"] for t in trace), 2),
            "llm_calls": sum(1 for m in metrics if m["llm_call"]),
            "tool_calls": len(trace),
            "failed_tool_calls": sum(1 for t in trace if not t["ok"]),
            "input_tokens": sum(m["input_tokens"] for m in metrics),
            "output_tokens": sum(m["output_tokens"] for m in metrics),
            "per_node": metrics,
        },
    }


async def run_investigation(goal: str, thread_id: str) -> dict:
    graph = await get_graph()
    await graph.ainvoke({"goal": goal}, _config(thread_id))
    return await _snapshot(graph, thread_id)


async def resume_investigation(thread_id: str, approved: bool) -> dict:
    graph = await get_graph()
    await graph.ainvoke(Command(resume={"approved": approved}), _config(thread_id))
    return await _snapshot(graph, thread_id)


async def get_investigation(thread_id: str) -> dict:
    return await _snapshot(await get_graph(), thread_id)
