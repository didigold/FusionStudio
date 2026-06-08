@echo off
title FusionStudio Pro - Desktop Packager
echo ==================================================
echo Starting FusionStudio Pro Packaging process...
echo ==================================================
echo.

python scripts/build_desktop.py

if %errorlevel% neq 0 (
    echo.
    echo ==================================================
    echo [ERROR] Packaging process failed!
    echo ==================================================
    pause
    exit /b %errorlevel%
)

echo.
echo ==================================================
echo [SUCCESS] Standalone app folder is ready!
echo Location: dist\FusionStudio_Pro\
echo ==================================================
echo.
pause
