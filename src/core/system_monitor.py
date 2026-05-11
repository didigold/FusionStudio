"""
SystemMonitorWorker - Periodically collects CPU, RAM, and GPU metrics.
Emits stats dict for UI updates.
"""
from PySide6.QtCore import QThread, Signal


class SystemMonitorWorker(QThread):
    stats = Signal(dict)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._running = True

    def run(self):
        import psutil
        has_gpu = False
        handle = None
        try:
            import pynvml
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            has_gpu = True
        except Exception:
            has_gpu = False

        while self._running:
            try:
                data = {
                    "cpu": psutil.cpu_percent(interval=1),
                    "ram_mb": psutil.Process().memory_info().rss // (1024 * 1024),
                }
                if has_gpu:
                    try:
                        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
                        temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                        data["gpu_util"] = util.gpu
                        data["gpu_vram_mb"] = mem.used // (1024 * 1024)
                        data["gpu_temp"] = temp
                    except Exception:
                        data["gpu_util"] = 0
                        data["gpu_vram_mb"] = 0
                        data["gpu_temp"] = 0
                self.stats.emit(data)
            except Exception:
                pass
            self.msleep(2000)

    def stop_monitor(self):
        self._running = False
        self.wait(3000)