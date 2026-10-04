@echo off
title TikTok y X to WhatsApp Sticker Studio
cd /d "%~dp0"

echo ======================================================
echo    Iniciando TikTok y X to WhatsApp Sticker Studio...
echo ======================================================
echo.

start "" "http://localhost:3000"
node src/server.js
pause
