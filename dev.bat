@echo off
title FusionStudio Pro - Dev Launcher
echo Starting FusionStudio Pro Development environment...

:: Start the FastAPI backend in a new command prompt window
start "FusionStudio Backend" cmd /k "set FUSIONSTUDIO_DEV=1&& python -m uvicorn backend.main:app --reload --port 8001"

:: Start the Vite frontend in the current command prompt window
echo Starting Frontend dev server...
cd frontend
npm run dev
