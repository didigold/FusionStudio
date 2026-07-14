import unittest
from unittest.mock import patch, MagicMock
from backend.core.system_monitor import collect_system_stats

class TestSystemMonitor(unittest.TestCase):
    @patch('backend.core.system_monitor.psutil')
    def test_collect_system_stats(self, mock_psutil):
        # Setup mock for psutil.cpu_percent
        mock_psutil.cpu_percent.return_value = 42.5

        # Setup mock for psutil.Process().memory_info().rss
        mock_process = MagicMock()
        mock_memory_info = MagicMock()
        # Set RSS to something that will yield 100 MB when divided by (1024 * 1024)
        mock_memory_info.rss = 100 * 1024 * 1024
        mock_process.memory_info.return_value = mock_memory_info
        mock_psutil.Process.return_value = mock_process

        # Call the function
        result = collect_system_stats()

        # Verify the result
        expected_data = {
            "cpu": 42.5,
            "ram_mb": 100,
            "gpu_util": 0,
            "gpu_vram_mb": 0,
            "gpu_temp": 0,
        }
        self.assertEqual(result, expected_data)

        # Verify mocks were called correctly
        mock_psutil.cpu_percent.assert_called_once_with(interval=None)
        mock_psutil.Process.assert_called_once()
        mock_process.memory_info.assert_called_once()

if __name__ == '__main__':
    unittest.main()
