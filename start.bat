@echo off
cd /d "%~dp0"
npm start
if %errorlevel% neq 0 pause
