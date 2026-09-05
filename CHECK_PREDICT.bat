@echo off
title Freight Intelligence - Predict Error Diagnostic
cd /d C:\SIH26006_ML_REBUILD

echo ==========================================
echo FREIGHT INTELLIGENCE PREDICT DIAGNOSTIC
echo ==========================================
echo.

echo [1] Searching backend /api/predict...
echo ------------------------------------------
findstr /S /N /I /C:"/api/predict" backend\*.py backend\*\*.py 2>nul

echo.
echo [2] Searching backend 400 errors...
echo ------------------------------------------
findstr /S /N /I /C:"400" backend\*.py backend\*\*.py 2>nul

echo.
echo [3] Searching HTTPException...
echo ------------------------------------------
findstr /S /N /I /C:"HTTPException" backend\*.py backend\*\*.py 2>nul

echo.
echo [4] Searching frontend prediction calls...
echo ------------------------------------------
findstr /S /N /I /C:"/api/predict" frontend\src\*.js frontend\src\*.jsx frontend\src\*.ts frontend\src\*.tsx 2>nul

echo.
echo [5] Searching country/port logic...
echo ------------------------------------------
findstr /S /N /I /C:"origin_country" frontend\src\*.js frontend\src\*.jsx frontend\src\*.ts frontend\src\*.tsx 2>nul

echo.
echo ==========================================
echo DIAGNOSTIC COMPLETE
echo ==========================================
pause