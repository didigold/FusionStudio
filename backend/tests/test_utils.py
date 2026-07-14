import unittest
from unittest.mock import patch
import sys
import os

# We need to import the function to test
# To do this, we need to ensure the parent directory of 'backend' is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.core.utils import resource_path
import backend.core.utils as utils_module

class TestResourcePath(unittest.TestCase):
    def test_resource_path_with_meipass(self):
        with patch.object(sys, '_MEIPASS', '/mocked/meipass', create=True):
            path = resource_path('assets/image.png')
            self.assertEqual(path, os.path.join('/mocked/meipass', 'backend/assets/image.png'))

    def test_resource_path_without_meipass(self):
        # We need to make sure _MEIPASS is temporarily deleted if it exists,
        # but in normal execution it won't exist.
        if hasattr(sys, '_MEIPASS'):
            del sys._MEIPASS

        expected_base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(utils_module.__file__))))
        path = resource_path('backend/test.txt')
        self.assertEqual(path, os.path.join(expected_base, 'backend/test.txt'))

    def test_path_mappings(self):
        with patch.object(sys, '_MEIPASS', '/mocked', create=True):
            mappings = [
                ('assets/img.png', 'backend/assets/img.png'),
                ('models', 'backend/models'),
                ('models/model.bin', 'backend/models/model.bin'),
                ('config', 'backend/config'),
                ('config/settings.json', 'backend/config/settings.json'),
                ('other/file.txt', 'backend/assets/other/file.txt'),
                ('backend/direct/file.txt', 'backend/direct/file.txt')
            ]
            for input_path, expected_rel in mappings:
                with self.subTest(input_path=input_path):
                    self.assertEqual(
                        resource_path(input_path),
                        os.path.join('/mocked', expected_rel)
                    )

if __name__ == '__main__':
    unittest.main()
