#!/usr/bin/env python3
"""
Twilio integration endpoints (Plan A - Web only front-end)

Endpoints:
- POST /twilio/voice           -> Webhook for incoming PSTN; dials a Client identity
- GET  /twilio/token           -> Issues AccessToken for Voice JS SDK
- POST /twilio/sms/busy        -> Sends "I'm busy" SMS to caller

Environment variables required:
- TWILIO_ACCOUNT_SID           # Your Twilio Account SID
- TWILIO_API_KEY_SID
- TWILIO_API_KEY_SECRET
- TWIML_APP_SID                # TwiML Application SID for outgoing calls
- TWILIO_PHONE_NUMBER          # From number to send SMS
- PUBLIC_CLIENT_IDENTITY       # Optional default client identity (e.g., "visionnav_web")
"""

import os
import json
import asyncio
from typing import Set
from fastapi import FastAPI, Request, Body, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.rest import Client as TwilioRestClient
from twilio.twiml.voice_response import VoiceResponse, Dial
from dotenv import load_dotenv

app = FastAPI()

# CORS for local dev: allow web app on a different port to call these endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

# WebSocket连接管理
active_connections: Set[WebSocket] = set()


class BusySMSPayload(BaseModel):
    to: str
    message: str | None = "I'm busy"


def _env(key: str, required: bool = True, default: str | None = None) -> str:
    val = os.getenv(key, default)
    if required and not val:
        raise RuntimeError(f"Missing env var: {key}")
    return val  # type: ignore


@app.post("/twilio/voice", response_class=PlainTextResponse)
async def twilio_voice_webhook(request: Request):
    """Incoming call webhook from Twilio -> return TwiML.

    We route the call to a Twilio Client identity so that the web app (Voice JS SDK)
    can accept the call. Identity can be provided via query (?identity=xxx) or
    environment variable PUBLIC_CLIENT_IDENTITY.
    """
    params = dict(request.query_params)
    identity = params.get("identity") or os.getenv("PUBLIC_CLIENT_IDENTITY", "visionnav_web")

    vr = VoiceResponse()
    dial = Dial()
    dial.client(identity)
    vr.append(dial)
    # Return TwiML
    return PlainTextResponse(str(vr), media_type="application/xml")





@app.get("/twilio/token")
async def twilio_token(identity: str | None = None):
    """Issue an access token for Twilio Voice JS SDK (web)."""
    account_sid = _env("TWILIO_ACCOUNT_SID")
    api_key = _env("TWILIO_API_KEY_SID")
    api_secret = _env("TWILIO_API_KEY_SECRET")
    app_sid = _env("TWIML_APP_SID")

    final_identity = identity or os.getenv("PUBLIC_CLIENT_IDENTITY", "visionnav_web")

    token = AccessToken(account_sid, api_key, api_secret, identity=final_identity)
    voice_grant = VoiceGrant(outgoing_application_sid=app_sid, incoming_allow=True)
    token.add_grant(voice_grant)

    return {"identity": final_identity, "token": token.to_jwt()}


@app.post("/twilio/sms/busy")
async def twilio_sms_busy(payload: BusySMSPayload):
    """Send 'I'm busy' SMS to a phone number via Twilio REST API."""
    account_sid = _env("TWILIO_ACCOUNT_SID")
    auth_token = _env("TWILIO_AUTH_TOKEN")
    from_number = _env("TWILIO_PHONE_NUMBER")

    client = TwilioRestClient(account_sid, auth_token)
    msg = client.messages.create(
        to=payload.to,
        from_=from_number,
        body=payload.message or "I'm busy",
    )
    return {"sid": msg.sid, "status": msg.status}


# ============ MOCK API FOR TESTING ============

class MockIncomingCallPayload(BaseModel):
    from_number: str = "+4552223460"  # Default to verified number

@app.websocket("/ws/mock")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for mock call triggers"""
    await websocket.accept()
    active_connections.add(websocket)
    print(f"🔌 WebSocket connected. Total connections: {len(active_connections)}")
    
    try:
        while True:
            # 保持连接活跃
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print(f"🔌 WebSocket disconnected. Total connections: {len(active_connections)}")

async def broadcast_mock_call(from_number: str):
    """向所有连接的WebSocket客户端广播模拟来电"""
    message = {
        "type": "mock_incoming_call",
        "from_number": from_number,
        "timestamp": int(asyncio.get_event_loop().time())
    }
    
    disconnected = set()
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(message))
            print(f"📡 Sent mock call to WebSocket client")
        except:
            disconnected.add(connection)
    
    # 清理断开的连接
    for conn in disconnected:
        active_connections.discard(conn)

@app.post("/mock/trigger-incoming-call")
async def mock_trigger_incoming_call(payload: MockIncomingCallPayload):
    """
    Trigger a mock incoming call via WebSocket to frontend.
    
    Usage:
    POST /mock/trigger-incoming-call
    {
        "from_number": "+4552223460"  // Optional, defaults to verified number
    }
    
    This will broadcast to all connected WebSocket clients.
    """
    print(f"🎯 API: Triggering mock incoming call from {payload.from_number}")
    
    # 通过WebSocket广播到所有连接的前端
    await broadcast_mock_call(payload.from_number)
    
    return {
        "success": True,
        "from_number": payload.from_number,
        "message": "Mock incoming call broadcasted via WebSocket",
        "connected_clients": len(active_connections)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)

