@echo off
setlocal
PowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-remote.ps1" %*
endlocal