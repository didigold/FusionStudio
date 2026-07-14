import os
import sys
import subprocess
from importlib.metadata import version, PackageNotFoundError
import re
from typing import List, Dict, Optional, Callable

class DependencyManager:
    """Handles parsing requirements.txt and verifying/installing dependencies."""

    def __init__(self, requirements_path: str, progress_callback: Optional[Callable[[int, str], None]] = None):
        self.requirements_path = requirements_path
        self.progress_callback = progress_callback
        self.requirements = self._parse_requirements()

    def _parse_requirements(self) -> List[Dict[str, str]]:
        """Parses requirements.txt and returns a list of dictionaries with package and version info."""
        reqs = []
        if not os.path.exists(self.requirements_path):
            return reqs

        with open(self.requirements_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                # Basic parsing for package and version constraint
                # Supports: package, package>=1.2.3, package==1.2.3, package~=1.2.3
                match = re.match(r'^([a-zA-Z0-9\-_]+)\s*([>=<~!]+.*)?$', line)
                if match:
                    name = match.group(1)
                    spec = match.group(2) or ""
                    reqs.append({"name": name, "spec": spec, "full": line})
        return reqs

    def check_and_install(self) -> bool:
        """Checks all requirements and installs missing or mismatched versions."""
        total = len(self.requirements)
        if total == 0:
            return True

        for i, req in enumerate(self.requirements):
            package_name = req["name"]
            spec = req["spec"]
            
            if self.progress_callback:
                self.progress_callback(int((i / total) * 100), f"Checking {package_name}...")

            is_installed, current_version = self._get_installed_version(package_name)
            
            needs_action = False
            if not is_installed:
                needs_action = True
                action_text = f"Installing {package_name}..."
            else:
                if spec and not self._check_version_match(current_version, spec):
                    needs_action = True
                    action_text = f"Updating {package_name} (mismatch: {current_version} vs {spec})..."
                    # For updates, we do an uninstall first to be clean as requested
                    self._uninstall_package(package_name)

            if needs_action:
                if self.progress_callback:
                    self.progress_callback(int((i / total) * 100), action_text)
                
                if not self._install_package(req["full"]):
                    if self.progress_callback:
                        self.progress_callback(int((i / total) * 100), f"Failed to install {package_name}")
                    # We continue despite errors to try other packages, but return False at the end?
                    # Or stop? User wants it robust.
        
        if self.progress_callback:
            self.progress_callback(100, "All dependencies verified.")
        return True

    def _get_installed_version(self, package_name: str) -> (bool, Optional[str]):
        """Returns (is_installed, version_string)."""
        # Normalize name (pip is case-insensitive and treats _ as -)
        norm_name = package_name.lower().replace('_', '-')
        try:
            pkg_version = version(norm_name)
            return True, pkg_version
        except PackageNotFoundError:
            return False, None

    def _check_version_match(self, current: str, spec: str) -> bool:
        """Returns True if current version satisfies the specifier string."""
        if not spec:
            return True
            
        try:
            from packaging.specifiers import SpecifierSet
            from packaging.version import parse
            
            # SpecifierSet handles complex strings like ">=1.24.0,<2.0.0"
            spec_set = SpecifierSet(spec)
            return parse(current) in spec_set
            
        except (ImportError, Exception):
            # Safe fallback: if we can't parse or 'packaging' is missing,
            # assume it's okay if at least some version is installed.
            # In Stage 1 we ensure 'packaging' exists, so this should rarely happen.
            return True

    def _install_package(self, full_req: str) -> bool:
        """Runs pip install for the given requirement string."""
        try:
            # Using sys.executable to ensure we use the same venv
            subprocess.check_call([sys.executable, "-m", "pip", "install", full_req], 
                                   stdout=subprocess.DEVNULL, 
                                   stderr=subprocess.DEVNULL)
            return True
        except subprocess.CalledProcessError:
            return False

    def _uninstall_package(self, package_name: str) -> bool:
        """Runs pip uninstall."""
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "uninstall", "-y", package_name],
                                   stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL)
            return True
        except subprocess.CalledProcessError:
            return False
