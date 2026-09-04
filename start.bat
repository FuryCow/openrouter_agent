@echo off
chcp 65001 >nul
title OpenRouter Agent

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo Stopping old Electron processes...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM "OpenRouter Agent.exe" >nul 2>&1
timeout /t 1 /nobreak >nul

echo Building latest version...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo Starting OpenRouter Agent...
call npm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start the app.
    pause
    exit /b 1
)
