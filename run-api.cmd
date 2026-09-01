@echo off
REM Launches run-api.ps1 regardless of which shell you are in.
REM Any arguments are passed through, e.g.  run-api.cmd -NoBuild
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-api.ps1" %*
