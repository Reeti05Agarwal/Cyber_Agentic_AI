"""
CyberSentinel v3.0 - Multi-Agent Router
Starts, approves and inspects multi-agent investigations (LangGraph + MCP).
"""
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.workflow import get_investigation, load_mcp_tools, resume_investigation, run_investigation
from app.mcp_server import ACTIVE_TOOLS

router = APIRouter(prefix="/agents", tags=["agents"])


class InvestigateRequest(BaseModel):
    goal: str = Field(min_length=3, max_length=2000, examples=["Check DNS, SSL and security headers for example.com"])


class ApprovalRequest(BaseModel):
    approved: bool


@router.get("/tools")
async def list_mcp_tools():
    """Tools the agents discovered from the CyberSentinel MCP server."""
    try:
        tools = await load_mcp_tools()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"MCP server unavailable: {e}")
    return {
        "mcp_server": "cybersentinel",
        "tools": [
            {"name": t.name, "active": t.name in ACTIVE_TOOLS, "description": t.description, "args": t.args}
            for t in tools
        ],
    }


@router.post("/investigate")
async def investigate(req: InvestigateRequest):
    """Run the planner, investigator and reporter agents on a goal.

    Returns status "awaiting_approval" when the plan contains active scans;
    approve or reject with POST /api/agents/{thread_id}/approve.
    """
    try:
        return await run_investigation(req.goal, str(uuid.uuid4()))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Investigation failed: {e}")


@router.post("/{thread_id}/approve")
async def approve(thread_id: str, req: ApprovalRequest):
    """Human-in-the-loop decision for a paused investigation."""
    state = await get_investigation(thread_id)
    if state["status"] != "awaiting_approval":
        raise HTTPException(status_code=409, detail=f"Investigation is not waiting for approval (status: {state['status']})")
    try:
        return await resume_investigation(thread_id, req.approved)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Investigation failed: {e}")


@router.get("/{thread_id}")
async def investigation_status(thread_id: str):
    """Current state of an investigation: plan, tool trace, report and metrics."""
    state = await get_investigation(thread_id)
    if not state["goal"]:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return state
