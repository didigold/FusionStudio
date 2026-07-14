import unittest
from unittest.mock import patch, MagicMock
import numpy as np
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.core.logic_engine import calculate_ncap_metrics

class TestLogicEngine(unittest.TestCase):
    def test_calculate_ncap_metrics_no_start_mark(self):
        with patch('backend.core.logic_engine.MDF') as MockMDF:
            result = calculate_ncap_metrics("dummy.mf4", {}, marks={})
            self.assertEqual(result, {"error": "No Start Mark (T0) found for this file."})

    def test_calculate_ncap_metrics_success(self):
        with patch('backend.core.logic_engine.MDF') as MockMDF:
            mock_mdf_instance = MockMDF.return_value.__enter__.return_value
            mock_mdf_instance.channels_db = {
                'gaze_channel': [(0, 0)],
                'event_channel': [(0, 1)]
            }

            mock_gaze_sig = MagicMock()
            mock_gaze_sig.samples = np.array([0.0, 0.0, 1.0, 1.0])
            mock_gaze_sig.timestamps = np.array([0.0, 1.0, 2.0, 3.0])

            mock_event_sig = MagicMock()
            mock_event_sig.samples = np.array([0.0, 0.0, 0.0, 1.0])
            mock_event_sig.timestamps = np.array([0.0, 1.0, 2.0, 2.5])

            def mdf_get_side_effect(ch_name, group=None, index=None):
                if ch_name == 'gaze_channel':
                    return mock_gaze_sig
                if ch_name == 'event_channel':
                    return mock_event_sig
                return None

            mock_mdf_instance.get.side_effect = mdf_get_side_effect

            marks = {"dummy.mf4": [1.0]} # T0 = 1.0
            signal_map = {"gaze": "gaze_channel", "event": "event_channel"}

            result = calculate_ncap_metrics("dummy.mf4", signal_map, marks=marks)

            self.assertEqual(result["t0"], 1.0)
            self.assertEqual(result["t_gaze"], 1.0)
            self.assertTrue(result["pass_gaze"])
            self.assertEqual(result["t_event"], 1.5)
            self.assertTrue(result["pass_event"])
            self.assertTrue(result["overall_pass"])

    def test_calculate_ncap_metrics_fail_threshold(self):
        with patch('backend.core.logic_engine.MDF') as MockMDF:
            mock_mdf_instance = MockMDF.return_value.__enter__.return_value
            mock_mdf_instance.channels_db = {
                'gaze_channel': [(0, 0)],
                'event_channel': [(0, 1)]
            }

            mock_gaze_sig = MagicMock()
            mock_gaze_sig.samples = np.array([0.0, 0.0, 0.0, 0.0, 1.0])
            mock_gaze_sig.timestamps = np.array([0.0, 1.0, 2.0, 3.0, 4.0])

            mock_event_sig = MagicMock()
            mock_event_sig.samples = np.array([0.0, 1.0])
            mock_event_sig.timestamps = np.array([0.0, 1.0])

            def mdf_get_side_effect(ch_name, group=None, index=None):
                if ch_name == 'gaze_channel':
                    return mock_gaze_sig
                if ch_name == 'event_channel':
                    return mock_event_sig
                return None

            mock_mdf_instance.get.side_effect = mdf_get_side_effect

            marks = {"dummy.mf4": 1.0}
            signal_map = {"gaze": "gaze_channel", "event": "event_channel"}

            result = calculate_ncap_metrics("dummy.mf4", signal_map, marks=marks)

            self.assertEqual(result["t_gaze"], 3.0)
            self.assertFalse(result["pass_gaze"])
            self.assertFalse(result["overall_pass"])

    def test_calculate_ncap_metrics_error(self):
        with patch('backend.core.logic_engine.MDF', side_effect=Exception("Test error")):
            result = calculate_ncap_metrics("dummy.mf4", {}, marks={})
            self.assertIn("error", result)
            self.assertEqual(result["error"], "Test error")

if __name__ == '__main__':
    unittest.main()
