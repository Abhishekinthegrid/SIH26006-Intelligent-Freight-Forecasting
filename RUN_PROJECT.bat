@echo off
setlocal
start "SIH26006 Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
start "SIH26006 Frontend" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"
endlocal
