import asyncio
import logging
from fastapi import WebSocket
from typing import List


logger = logging.getLogger("fusionstudio.ws")


class ConnectionManager:
    def __init__(self, name: str = "default"):
        self.name = name
        self.active: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.append(ws)
        logger.debug("[%s] Client connected. Total: %d", self.name, len(self.active))

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self.active:
                self.active.remove(ws)
        logger.debug("[%s] Client disconnected. Total: %d", self.name, len(self.active))

    async def broadcast(self, data: dict):
        if not self.active:
            return
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    async def send_to(self, ws: WebSocket, data: dict):
        try:
            await ws.send_json(data)
        except Exception:
            await self.disconnect(ws)

    @property
    def client_count(self) -> int:
        return len(self.active)


manager_system = ConnectionManager("system")
manager_fuse = ConnectionManager("fuse")
manager_classify = ConnectionManager("classify")
manager_brain = ConnectionManager("brain")
manager_analysis = ConnectionManager("analysis")
manager_reporting = ConnectionManager("reporting")