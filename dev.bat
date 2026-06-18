@echo off
title FusionStudio - Dev Launcher
echo Starting FusionStudio Development environment...

start "FusionStudio Backend" cmd /k "set FUSIONSTUDIO_DEV=1 && python -m uvicorn backend.main:app --reload --port 8001"

cd frontend

if not exist node_modules goto install
goto start_frontend

:install
echo [Dev Launcher] node_modules not found. Running npm install...
call npm install

:start_frontend
echo Starting Frontend dev server...
npm run dev
