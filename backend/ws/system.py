import asyncio
import logging

from backend.ws.manager import manager_system

logger = logging.getLogger("fusionstudio.system")


async def system_monitor_loop():
    has_gpu = False
    handle = None
    nvml_initialized = False

    while True:
        try:
            if not nvml_initialized:
                try:
                    import pynvml
                    pynvml.nvmlInit()
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    has_gpu = True
                    nvml_initialized = True
                    logger.info("NVML initialized, GPU monitoring active")
                except Exception:
                    has_gpu = False
                    nvml_initialized = False

            from backend.core.system_monitor import collect_system_stats
            data = collect_system_stats()

            if not has_gpu:
                try:
                    import pynvml
                    pynvml.nvmlInit()
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    has_gpu = True
                    nvml_initialized = True
                except Exception:
                    data["gpu_util"] = 0
                    data["gpu_vram_mb"] = 0
                    data["gpu_temp"] = 0

            if has_gpu:
                try:
                    import pynvml
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
                    temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                    data["gpu_util"] = util.gpu
                    data["gpu_vram_mb"] = mem.used // (1024 ** 2)
                    data["gpu_temp"] = temp
                except Exception:
                    data["gpu_util"] = 0
                    data["gpu_vram_mb"] = 0
                    data["gpu_temp"] = 0
                    has_gpu = False
                    nvml_initialized = False
                    logger.warning("GPU stats collection failed, will retry")

            data["type"] = "system_stats"
            await manager_system.broadcast(data)

        except Exception as e:
            logger.error("System monitor error: %s", e)

        await asyncio.sleep(2)