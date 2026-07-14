import unittest
from unittest.mock import patch
import os
from backend.core.utils import user_data_path

class TestUtilsUserDataPath(unittest.TestCase):

    @patch('backend.core.utils.os.makedirs')
    @patch('backend.core.utils.os.path.expanduser')
    @patch.dict('backend.core.utils.os.environ', {}, clear=True)
    def test_user_data_path_expanduser_fallback(self, mock_expanduser, mock_makedirs):
        # Test fallback to os.path.expanduser("~") when no env vars are set
        mock_expanduser.return_value = '/home/user'
        result = user_data_path()
        expected = os.path.join('/home/user', 'FusionStudio')
        self.assertEqual(result, expected)
        mock_makedirs.assert_called_once_with(expected, exist_ok=True)

    @patch('backend.core.utils.os.makedirs')
    @patch.dict('backend.core.utils.os.environ', {'LOCALAPPDATA': '/local/app/data', 'APPDATA': '/app/data'}, clear=True)
    def test_user_data_path_localappdata(self, mock_makedirs):
        # Test LOCALAPPDATA takes precedence
        result = user_data_path()
        expected = os.path.join('/local/app/data', 'FusionStudio')
        self.assertEqual(result, expected)
        mock_makedirs.assert_called_once_with(expected, exist_ok=True)

    @patch('backend.core.utils.os.makedirs')
    @patch.dict('backend.core.utils.os.environ', {'APPDATA': '/app/data'}, clear=True)
    def test_user_data_path_appdata(self, mock_makedirs):
        # Test APPDATA is used when LOCALAPPDATA is absent
        result = user_data_path()
        expected = os.path.join('/app/data', 'FusionStudio')
        self.assertEqual(result, expected)
        mock_makedirs.assert_called_once_with(expected, exist_ok=True)

    @patch('backend.core.utils.os.makedirs')
    @patch.dict('backend.core.utils.os.environ', {'LOCALAPPDATA': '/local'}, clear=True)
    def test_user_data_path_with_assets_relative_path(self, mock_makedirs):
        # Test relative path logic for 'assets/' prefix
        result = user_data_path('assets/image.png')
        expected = os.path.join('/local', 'FusionStudio', 'backend/assets/image.png')
        self.assertEqual(result, expected)
        mock_makedirs.assert_called_once_with(os.path.dirname(expected), exist_ok=True)

    @patch('backend.core.utils.os.makedirs')
    @patch.dict('backend.core.utils.os.environ', {'LOCALAPPDATA': '/local'}, clear=True)
    def test_user_data_path_with_models_relative_path(self, mock_makedirs):
        # Test relative path logic for 'models' and 'models/'
        result_exact = user_data_path('models')
        expected_exact = os.path.join('/local', 'FusionStudio', 'backend/models')
        self.assertEqual(result_exact, expected_exact)

        result_prefix = user_data_path('models/model.onnx')
        expected_prefix = os.path.join('/local', 'FusionStudio', 'backend/models/model.onnx')
        self.assertEqual(result_prefix, expected_prefix)

    @patch('backend.core.utils.os.makedirs')
    @patch.dict('backend.core.utils.os.environ', {'LOCALAPPDATA': '/local'}, clear=True)
    def test_user_data_path_with_config_relative_path(self, mock_makedirs):
        # Test relative path logic for 'config' and 'config/'
        result_exact = user_data_path('config')
        expected_exact = os.path.join('/local', 'FusionStudio', 'backend/config')
        self.assertEqual(result_exact, expected_exact)

        result_prefix = user_data_path('config/settings.json')
        expected_prefix = os.path.join('/local', 'FusionStudio', 'backend/config/settings.json')
        self.assertEqual(result_prefix, expected_prefix)

    @patch('backend.core.utils.os.makedirs')
    @patch.dict('backend.core.utils.os.environ', {'LOCALAPPDATA': '/local'}, clear=True)
    def test_user_data_path_with_other_relative_path(self, mock_makedirs):
        # Test relative path logic when it doesn't start with backend/, models, config, assets
        result = user_data_path('some_file.txt')
        expected = os.path.join('/local', 'FusionStudio', 'backend/assets/some_file.txt')
        self.assertEqual(result, expected)

    @patch('backend.core.utils.os.makedirs')
    @patch.dict('backend.core.utils.os.environ', {'LOCALAPPDATA': '/local'}, clear=True)
    def test_user_data_path_with_backend_relative_path(self, mock_makedirs):
        # Test relative path logic when it already starts with 'backend/'
        result = user_data_path('backend/routers/main.py')
        expected = os.path.join('/local', 'FusionStudio', 'backend/routers/main.py')
        self.assertEqual(result, expected)

if __name__ == '__main__':
    unittest.main()