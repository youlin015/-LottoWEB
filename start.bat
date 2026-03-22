@echo off
title Taiwan Lottery Situation Room Launcher
echo ==================================================
echo   Starting Taiwan Lottery Situation Room
echo ==================================================
echo.

echo [INFO] Starting Python FastAPI Backend Server...
start "Backend - FastAPI" cmd /k "cd backend && call .\venv\Scripts\activate.bat && uvicorn main:app --reload"

echo [INFO] Starting React Vite Frontend Server...
start "Frontend - React" cmd /k "cd frontend && npm run dev"

echo.
echo [SUCCESS] Both servers are starting in separate windows!
echo Please wait a few seconds, then open your browser at:
echo http://localhost:5173
echo.
pause
