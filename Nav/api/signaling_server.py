#!/usr/bin/env python3
"""
WebRTC Signaling Server
用于协调两个设备之间的WebRTC连接
"""

import asyncio
import json
import logging
import websockets
from typing import Dict, Any

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局单例信令服务器
class SignalingServer:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.devices = {}
            cls._instance.rooms = {}
        return cls._instance
    
    def __init__(self):
        # 避免重复初始化
        if hasattr(self, 'initialized'):
            return
        self.devices = {}
        self.rooms = {}
        self.initialized = True

    async def register_device(self, websocket, device_id: str):
        """注册设备"""
        self.devices[device_id] = websocket
        logger.info(f"Device {device_id} connected. Total: {len(self.devices)}")

        await websocket.send(json.dumps({
            "type": "registered",
            "device_id": device_id,
            "online_devices": list(self.devices.keys())
        }))
        # 广播最新在线设备列表给其他设备
        await self.broadcast_device_list(exclude=device_id)

    async def unregister_device(self, device_id: str):
        """注销设备"""
        if device_id in self.devices:
            del self.devices[device_id]
        if device_id in self.rooms:
            del self.rooms[device_id]
        logger.info(f"Device {device_id} disconnected. Total: {len(self.devices)}")
        # 广播最新在线设备列表
        await self.broadcast_device_list()

    async def broadcast_device_list(self, exclude: str | None = None):
        """广播所有在线设备列表给所有连接的客户端"""
        payload = json.dumps({
            "type": "device_list",
            "online_devices": list(self.devices.keys())
        })
        for dev_id, ws in list(self.devices.items()):
            if exclude and dev_id == exclude:
                continue
            try:
                await ws.send(payload)
            except websockets.exceptions.ConnectionClosed:
                pass

    async def handle_call_request(self, from_device: str, to_device: str):
        """处理通话请求"""
        if to_device in self.devices:
            target_websocket = self.devices[to_device]
            await target_websocket.send(json.dumps({
                "type": "incoming_call",
                "from": from_device
            }))
            logger.info(f"Call request from {from_device} to {to_device}")
        else:
            if from_device in self.devices:
                await self.devices[from_device].send(json.dumps({
                    "type": "call_failed",
                    "reason": "target_offline"
                }))

    async def handle_call_response(self, from_device: str, response_type: str, to_device: str = None):
        """处理通话响应（接受/拒绝）"""
        target_device = to_device
        if not target_device:
            for device_id in self.devices:
                if device_id != from_device:
                    target_device = device_id
                    break

        if target_device and target_device in self.devices:
            await self.devices[target_device].send(json.dumps({
                "type": response_type,
                "from": from_device
            }))
            logger.info(f"Call {response_type} from {from_device} to {target_device}")

    async def relay_signaling(self, from_device: str, to_device: str, message: dict):
        """转发信令消息（offer, answer, ice_candidate）"""
        if to_device in self.devices:
            message["from"] = from_device
            await self.devices[to_device].send(json.dumps(message))
            logger.info(f"Relayed {message['type']} from {from_device} to {to_device}")

    async def broadcast_to_others(self, from_device: str, message: dict):
        """广播消息给其他设备"""
        message["from"] = from_device
        for device_id, websocket in self.devices.items():
            if device_id != from_device:
                try:
                    await websocket.send(json.dumps(message))
                except websockets.exceptions.ConnectionClosed:
                    pass

    async def handle_message(self, websocket, device_id: str, message: dict):
        """处理收到的消息"""
        message_type = message.get("type")

        if message_type == "call_request":
            await self.handle_call_request(device_id, message.get("to"))

        elif message_type == "call_accepted":
            await self.handle_call_response(device_id, "call_accepted", message.get("to"))

        elif message_type == "call_rejected":
            await self.handle_call_response(device_id, "call_rejected", message.get("to"))

        elif message_type in ["offer", "answer", "ice_candidate"]:
            to_device = message.get("to")
            if to_device:
                await self.relay_signaling(device_id, to_device, message)
            else:
                await self.broadcast_to_others(device_id, message)

        elif message_type == "chat":
            # Relay chat message via signaling (for when no data channel)
            to_device = message.get("to")
            payload = {
                "type": "chat",
                "content": message.get("content"),
                "timestamp": message.get("timestamp"),
            }
            if to_device:
                await self.relay_signaling(device_id, to_device, payload)
            else:
                await self.broadcast_to_others(device_id, payload)

        elif message_type == "call_end":
            await self.broadcast_to_others(device_id, message)

        else:
            logger.warning(f"Unknown message type: {message_type}")


async def handle_client(websocket):
    """处理客户端连接"""
    device_id = None
    server = SignalingServer()

    try:
        async for message in websocket:
            try:
                data = json.loads(message)

                if data.get("type") == "register":
                    device_id = data.get("device_id")
                    if device_id:
                        await server.register_device(websocket, device_id)
                else:
                    if device_id:
                        await server.handle_message(websocket, device_id, data)
                    else:
                        logger.warning("Received message from unregistered device")

            except json.JSONDecodeError:
                logger.error("Invalid JSON received")
            except Exception as e:
                logger.error(f"Error handling message: {e}")

    except websockets.exceptions.ConnectionClosed:
        logger.info("Client connection closed")
    except Exception as e:
        logger.error(f"Error in handle_client: {e}")
    finally:
        if device_id:
            await server.unregister_device(device_id)


async def main():
    """启动信令服务器"""
    # host = "localhost"
    host = "0.0.0.0"
    port = 8004
    
    logger.info(f"Starting WebRTC signaling server on {host}:{port}")
    
    async with websockets.serve(handle_client, host, port):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Signaling server stopped")
