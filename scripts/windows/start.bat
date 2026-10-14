@echo off
title Dakhl-o-Kharj server (close this window to stop)
cd /d "%~dp0..\.."
node --disable-warning=ExperimentalWarning server\src\main.js
echo.
echo Server stopped.
pause
