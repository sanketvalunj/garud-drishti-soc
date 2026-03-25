from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio
import json
import random
from datetime import datetime

router = APIRouter()

# Simulation Data
USERS = ["emp_101", "emp_102", "emp_103", "emp_104", "admin", "system"]
ASSETS = ["core-banking", "swift-terminal", "auth-server", "loan-db", "email-gateway", "we-server-01"]
EVENT_TYPES = [
    ("LOGIN_SUCCESS", "info"),
    ("FILE_ACCESS", "info"),
    ("PROCESS_START", "info"),
    ("NETWORK_CONNECTION", "info"),
    ("LOGIN_FAILED", "warning"),
    ("PORT_SCAN", "warning"),
    ("POWERSHELL_EXECUTION", "high"),
    ("PRIVILEGE_ESCALATION", "high"),
    ("DATA_EXFILTRATION", "critical")
]

async def event_generator():
    """
    Generates a stream of simulated SOC events.
    In a real system, this would tail a Kafka topic or Redis channel.
    """
    while True:
        # 1. Random delay to simulate traffic patterns
        await asyncio.sleep(random.uniform(0.5, 3.0))

        # 2. Pick random event attributes
        evt_type, severity = random.choice(EVENT_TYPES)
        user = random.choice(USERS)
        asset = random.choice(ASSETS)
        
        # 3. Construct Event Object
        event_data = {
            "timestamp": datetime.now().isoformat(),
            "event_type": evt_type,
            "user": user,
            "asset": asset,
            "severity": severity,
            "source_ip": f"192.168.1.{random.randint(2, 254)}"
        }

        # 4. Yield SSE format: "data: {json}\n\n"
        yield f"data: {json.dumps(event_data)}\n\n"

@router.get("/stream-events")
async def stream_events():
    """
    Server-Sent Events (SSE) endpoint for live SOC monitoring.
    """
    return StreamingResponse(event_generator(), media_type="text/event-stream")
