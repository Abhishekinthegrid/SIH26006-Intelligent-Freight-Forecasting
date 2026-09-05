@echo off
setlocal EnableExtensions EnableDelayedExpansion
title SIH26006 - FULL PROJECT CHECK
color 0A

echo ============================================================
echo        SIH26006 - FULL PROJECT HEALTH CHECK
echo ============================================================
echo.
echo This script checks files, Python/ML environment, frontend,
echo trained model, dataset, and (when running) the API.
echo It does NOT modify or retrain your project.
echo.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV=%BACKEND%\venv"
set "PY=%VENV%\Scripts\python.exe"
set "PASS=0"
set "FAIL=0"
set "WARN=0"

call :checkdir "%BACKEND%" "backend folder"
call :checkdir "%FRONTEND%" "frontend folder"
call :checkfile "%BACKEND%\app\main.py" "backend app/main.py"
call :checkfile "%BACKEND%\app\ml\predictor.py" "ML predictor"
call :checkfile "%BACKEND%\app\ml\train_model.py" "ML training script"
call :checkfile "%BACKEND%\app\routing.py" "routing module"
call :checkfile "%BACKEND%\data\maritime_ai_training_1m.csv" "1M training CSV"
call :checkfile "%BACKEND%\data\landmask.geojson" "land mask"
call :checkfile "%BACKEND%\models\freight_model.cbm" "trained CatBoost model"
call :checkfile "%FRONTEND%\package.json" "frontend package.json"
call :checkfile "%FRONTEND%\src\App.jsx" "frontend App.jsx"
call :checkfile "%FRONTEND%\src\main.jsx" "frontend main.jsx"
call :checkdir "%FRONTEND%\node_modules" "frontend node_modules"
call :checkfile "%ROOT%RUN_PROJECT.bat" "RUN_PROJECT.bat"
call :checkfile "%ROOT%RETRAIN_MODEL.bat" "RETRAIN_MODEL.bat"

echo.
echo ---------------- PYTHON ENVIRONMENT ----------------
if exist "%PY%" (
    echo [PASS] Project Python found.
    set /a PASS+=1
    "%PY%" --version
) else (
    echo [FAIL] Project Python not found: %PY%
    set /a FAIL+=1
)

if exist "%PY%" (
    "%PY%" -c "import fastapi,uvicorn,numpy,pandas,sklearn,catboost,shapely,searoute; print('PASS: all required backend imports loaded')" > "%TEMP%\sih_import_check.txt" 2>&1
    if errorlevel 1 (
        echo [FAIL] One or more backend packages cannot be imported.
        type "%TEMP%\sih_import_check.txt"
        set /a FAIL+=1
    ) else (
        type "%TEMP%\sih_import_check.txt"
        set /a PASS+=1
    )

    echo.
    echo ---------------- BACKEND COMPILE CHECK ----------------
    "%PY%" -m compileall -q "%BACKEND%\app"
    if errorlevel 1 (
        echo [FAIL] Python syntax/compile error found in backend\app.
        set /a FAIL+=1
    ) else (
        echo [PASS] Backend Python files compile successfully.
        set /a PASS+=1
    )
)

echo.
echo ---------------- MODEL CHECK ----------------
if exist "%BACKEND%\models\freight_model.cbm" (
    for %%A in ("%BACKEND%\models\freight_model.cbm") do echo Model size: %%~zA bytes
    if exist "%PY%" (
        "%PY%" -c "from catboost import CatBoostRegressor; m=CatBoostRegressor(); m.load_model(r'%BACKEND%\models\freight_model.cbm'); print('PASS: freight_model.cbm loads successfully')" > "%TEMP%\sih_model_check.txt" 2>&1
        if errorlevel 1 (
            echo [FAIL] Trained model could not be loaded.
            type "%TEMP%\sih_model_check.txt"
            set /a FAIL+=1
        ) else (
            type "%TEMP%\sih_model_check.txt"
            set /a PASS+=1
        )
    )
)

echo.
echo ---------------- CSV CHECK ----------------
if exist "%BACKEND%\data\maritime_ai_training_1m.csv" (
    echo Counting CSV rows...
    for /f "usebackq delims=" %%A in (`"%PY%" -c "import csv; p=r'%BACKEND%\data\maritime_ai_training_1m.csv'; f=open(p,encoding='utf-8-sig',newline=''); r=csv.reader(f); n=sum(1 for _ in r); print(n-1); f.close()"`) do set "ROWS=%%A"
    echo Data rows: !ROWS!
    if "!ROWS!"=="1000000" (
        echo [PASS] Dataset contains exactly 1,000,000 data rows.
        set /a PASS+=1
    ) else (
        echo [WARN] Dataset row count is !ROWS!, not exactly 1,000,000.
        set /a WARN+=1
    )

    "%PY%" -c "import csv; p=r'%BACKEND%\data\maritime_ai_training_1m.csv'; f=open(p,encoding='utf-8-sig',newline=''); h=next(csv.reader(f)); required=['origin_country','origin_port','destination_country','destination_port','cargo_type','quantity_tonnes','vessel_type','fuel_price_usd_tonne','port_congestion','month','freight_rate_usd_tonne']; missing=[x for x in required if x not in h]; print('PASS: required columns present') if not missing else print('FAIL: missing columns:',missing); raise SystemExit(1 if missing else 0)" > "%TEMP%\sih_csv_check.txt" 2>&1
    if errorlevel 1 (
        type "%TEMP%\sih_csv_check.txt"
        set /a FAIL+=1
    ) else (
        type "%TEMP%\sih_csv_check.txt"
        set /a PASS+=1
    )
)

echo.
echo ---------------- FRONTEND CHECK ----------------
where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo [FAIL] npm.cmd not found.
    set /a FAIL+=1
) else (
    echo [PASS] npm.cmd found.
    npm.cmd --version
    set /a PASS+=1
)

if exist "%FRONTEND%\package.json" (
    pushd "%FRONTEND%"
    npm.cmd ls --depth=0 > "%TEMP%\sih_npm_check.txt" 2>&1
    if errorlevel 1 (
        echo [WARN] Frontend npm dependencies may be incomplete.
        type "%TEMP%\sih_npm_check.txt"
        set /a WARN+=1
    ) else (
        echo [PASS] Frontend npm dependency tree is healthy.
        set /a PASS+=1
    )
    popd
)

echo.
echo ---------------- LIVE API CHECK ----------------
echo Checking whether backend is already running on port 8000...

curl.exe -s -o "%TEMP%\sih_health.json" -w "%%{http_code}" "http://127.0.0.1:8000/health" > "%TEMP%\sih_health_code.txt" 2>nul
set /p HEALTH=<"%TEMP%\sih_health_code.txt"

if "!HEALTH!"=="200" (
    echo [PASS] /health returned HTTP 200.
    set /a PASS+=1

    curl.exe -s -o "%TEMP%\sih_metadata.json" -w "%%{http_code}" "http://127.0.0.1:8000/api/metadata" > "%TEMP%\sih_metadata_code.txt" 2>nul
    set /p META=<"%TEMP%\sih_metadata_code.txt"
    if "!META!"=="200" (
        echo [PASS] /api/metadata returned HTTP 200.
        set /a PASS+=1
    ) else (
        echo [FAIL] /api/metadata returned HTTP !META!
        set /a FAIL+=1
    )

    curl.exe -s -o "%TEMP%\sih_route.json" -w "%%{http_code}" "http://127.0.0.1:8000/api/route?origin_port=Balikpapan&destination_port=Paradip&origin_country=Indonesia&destination_country=India" > "%TEMP%\sih_route_code.txt" 2>nul
    set /p ROUTE=<"%TEMP%\sih_route_code.txt"
    if "!ROUTE!"=="200" (
        echo [PASS] /api/route returned HTTP 200.
        set /a PASS+=1
    ) else (
        echo [FAIL] /api/route returned HTTP !ROUTE!
        type "%TEMP%\sih_route.json"
        set /a FAIL+=1
    )

    echo Testing /api/predict...
    curl.exe -s -o "%TEMP%\sih_predict.json" -w "%%{http_code}" -X POST "http://127.0.0.1:8000/api/predict" -H "Content-Type: application/json" -d "{\"origin_port\":\"Balikpapan\",\"destination_port\":\"Paradip\",\"origin_country\":\"Indonesia\",\"destination_country\":\"India\",\"cargo_type\":\"Coal\",\"quantity_tonnes\":50000,\"vessel_type\":\"Panamax\",\"fuel_price_usd_tonne\":620,\"port_congestion\":0.35,\"month\":\"March\"}" > "%TEMP%\sih_predict_code.txt" 2>nul
    set /p PRED=<"%TEMP%\sih_predict_code.txt"
    if "!PRED!"=="200" (
        echo [PASS] /api/predict returned HTTP 200.
        set /a PASS+=1
    ) else (
        echo [FAIL] /api/predict returned HTTP !PRED!
        echo Response:
        type "%TEMP%\sih_predict.json"
        set /a FAIL+=1
    )
) else (
    echo [WARN] Backend is not currently running on http://127.0.0.1:8000
    echo        Static checks above can still be used.
    set /a WARN+=1
)

echo.
echo ============================================================
echo                    FINAL PROJECT STATUS
echo ============================================================
echo PASS : !PASS!
echo WARN : !WARN!
echo FAIL : !FAIL!
echo.

if !FAIL! EQU 0 (
    if !WARN! EQU 0 (
        echo STATUS: ALL CHECKS PASSED - PROJECT LOOKS HEALTHY
        echo.
        echo You can run the project with:
        echo   RUN_PROJECT.bat
        exit /b 0
    ) else (
        echo STATUS: PROJECT CHECKED - NO HARD FAILURES, BUT WARNINGS EXIST
        exit /b 0
    )
) else (
    echo STATUS: PROBLEMS FOUND - SEE [FAIL] MESSAGES ABOVE
    exit /b 1
)

:checkdir
if exist "%~1\" (
    echo [PASS] %~2
    set /a PASS+=1
) else (
    echo [FAIL] Missing %~2 : %~1
    set /a FAIL+=1
)
exit /b

:checkfile
if exist "%~1" (
    echo [PASS] %~2
    set /a PASS+=1
) else (
    echo [FAIL] Missing %~2 : %~1
    set /a FAIL+=1
)
exit /b
