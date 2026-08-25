@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "PROJECT_DIR=%~dp0"
set "PROJECT_FILE=%PROJECT_DIR%Main.csproj"
set "PUBLISH_PROFILE=test-webmyps"
set "CONFIGURATION=Staging"
set "TARGET_FRAMEWORK=net8.0"
set "TARGET_SERVER=http://test-webmyps"
set "IIS_APP=test-webmyps"
set "PUBLISH_USER=DPWHNET\salaniokaes"
set "LOG_DIR=%PROJECT_DIR%deploy-logs"

if not exist "%PROJECT_FILE%" (
    echo ERROR: Main.csproj was not found beside this deploy script.
    echo Expected: "%PROJECT_FILE%"
    exit /b 1
)

where dotnet >nul 2>nul
if errorlevel 1 (
    echo ERROR: dotnet CLI was not found in PATH.
    exit /b 1
)

set "MSDEPLOY_EXE="
if exist "C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe" set "MSDEPLOY_EXE=C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe"
if not defined MSDEPLOY_EXE if exist "C:\Program Files (x86)\IIS\Microsoft Web Deploy V3\msdeploy.exe" set "MSDEPLOY_EXE=C:\Program Files (x86)\IIS\Microsoft Web Deploy V3\msdeploy.exe"
if not defined MSDEPLOY_EXE (
    echo ERROR: Web Deploy msdeploy.exe was not found.
    echo Install Microsoft Web Deploy or verify the installation path.
    exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if errorlevel 1 (
    echo ERROR: Could not create deploy log folder: "%LOG_DIR%"
    exit /b 1
)

for /f %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "LOG_FILE=%LOG_DIR%\Deploy-test-webmyps-%STAMP%.log"

cls
echo ============================================================
echo MYPS Web Deploy - test-webmyps
echo ============================================================
echo Project:       "%PROJECT_FILE%"
echo Profile:       %PUBLISH_PROFILE%
echo Configuration: %CONFIGURATION%
echo Framework:     %TARGET_FRAMEWORK%
echo Server:        %TARGET_SERVER%
echo IIS app:       %IIS_APP%
echo User:          %PUBLISH_USER%
echo Web Deploy:    "%MSDEPLOY_EXE%"
echo Log:           "%LOG_FILE%"
echo ============================================================
echo.
echo The password will be requested securely and will not be written to the log.
echo.

for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Read-Host 'Enter Web Deploy password' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { if($b -ne [IntPtr]::Zero){ [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) } }"`) do set "DEPLOY_PASSWORD=%%P"

if not defined DEPLOY_PASSWORD (
    echo ERROR: Password was empty. Publish cancelled.
    exit /b 1
)

echo Starting publish. This may run React-PreBuild.Staging.bat through Main.csproj...
echo.

dotnet publish "%PROJECT_FILE%" ^
    -c %CONFIGURATION% ^
    -f %TARGET_FRAMEWORK% ^
    /p:Configuration=%CONFIGURATION% ^
    /p:PublishProfile=%PUBLISH_PROFILE% ^
    /p:DeployOnBuild=true ^
    /p:Password="%DEPLOY_PASSWORD%" ^
    /p:AllowUntrustedCertificate=true ^
    /p:SkipExtraFilesOnServer=true ^
    > "%LOG_FILE%" 2>&1

set "PUBLISH_EXIT=%ERRORLEVEL%"
set "DEPLOY_PASSWORD="

if not "%PUBLISH_EXIT%"=="0" (
    echo.
    echo ============================================================
    echo PUBLISH FAILED. Exit code: %PUBLISH_EXIT%
    echo Log: "%LOG_FILE%"
    echo ============================================================
    echo Showing last 40 log lines:
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath '%LOG_FILE%' -Tail 40"
    exit /b %PUBLISH_EXIT%
)

echo.
echo ============================================================
echo PUBLISH SUCCEEDED
echo Site: %TARGET_SERVER%
echo Log:  "%LOG_FILE%"
echo ============================================================
exit /b 0
