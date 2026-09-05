@echo off
setlocal
cd /d %~dp0backend
if not exist venv python -m venv venv
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install -r requirements.txt
if not exist .env copy .env.example .env
if not exist models\freight_model.cbm (
  echo No trained model found. Training from the 1M CSV now...
  venv\Scripts\python.exe -m app.ml.train_model
) else (
  echo Existing model found. Skipping 1M-row training.
)
cd /d %~dp0frontend
npm.cmd install
call %~dp0RUN_PROJECT.bat
endlocal
