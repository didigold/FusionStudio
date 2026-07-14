import unittest
from unittest.mock import patch
import os
import tempfile
from backend.routers.analysis import _scan_analysis_dir

class TestAnalysisScan(unittest.TestCase):
    @patch('backend.routers.analysis.json.load')
    def test_scan_analysis_dir_exception(self, mock_json_load):
        # Setup a dummy directory and file so it enters the try block
        with tempfile.TemporaryDirectory() as temp_dir:
            dummy_file = os.path.join(temp_dir, 'GA_marks.json')
            with open(dummy_file, 'w') as f:
                f.write('{}')

            # Make json.load raise an exception
            mock_json_load.side_effect = Exception("Test Exception")

            # This should not raise an exception, but instead catch it and proceed
            # and since the folder doesn't have valid _FUSION_RESULTS or matching dirs,
            # it should return an empty list or minimal results without crashing.
            try:
                results = _scan_analysis_dir(temp_dir)
            except Exception as e:
                self.fail(f"_scan_analysis_dir raised Exception unexpectedly: {e}")

            self.assertTrue(mock_json_load.called)
