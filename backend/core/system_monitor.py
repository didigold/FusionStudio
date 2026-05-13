"""
SystemMonitor - System metrics collection for the WebSocket broadcast loop.
The async loop that calls this function lives in backend/ws/system.py.
This module provides only the data collection function.
"""
import psutil


def collect_system_stats():
    data = {
        "cpu": psutil.cpu_percent(interval=None),
        "ram_mb": psutil.Process().memory_info().rss // (1024 * 1024),
        "gpu_util": 0,
        "gpu_vram_mb": 0,
        "gpu_temp": 0,
    }
    return data