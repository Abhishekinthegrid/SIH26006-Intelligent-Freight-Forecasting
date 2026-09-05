@echo off
setlocal
cd /d %~dp0backend
venv\Scripts\python.exe -m app.ml.train_model
pause
endlocal
