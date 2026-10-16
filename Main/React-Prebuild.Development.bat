@echo off
echo Environment: Development
echo Starting React build...

cd /d "%~dp0..\FE"
if %errorlevel% neq 0 (
    echo ERROR: Could not find FE directory.
    exit /b %errorlevel%
)

:: echo Synchronizing Database Tables...
:: powershell -ExecutionPolicy Bypass -File "%~dp0Resources\Internal\SQLObjects\GenerateTables.ps1"
:: if %errorlevel% neq 0 (
::     echo WARNING: Database table sync failed or database is unreachable. Continuing build...
:: )

:: echo Installing dependencies...
:: call npm install
:: if %errorlevel% neq 0 (
::     echo ERROR: npm install failed.
::     exit /b %errorlevel%
:: )

echo Building React app...
call npm run build:dev
if %errorlevel% neq 0 (
    echo ERROR: npm build failed.
    exit /b %errorlevel%
)

echo React build completed successfully!