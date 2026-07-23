@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title PKUscore

cd /d "%~dp0"

set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -c "import sys; raise SystemExit(sys.version_info < (3, 10))" >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=py -3"
)

if not defined PYTHON_CMD (
    where python >nul 2>nul
    if not errorlevel 1 (
        python -c "import sys; raise SystemExit(sys.version_info < (3, 10))" >nul 2>nul
        if not errorlevel 1 set "PYTHON_CMD=python"
    )
)

if not defined PYTHON_CMD (
    echo.
    echo [错误] 没有找到 Python 3.10 或更高版本。
    echo 请安装 Python，并在安装界面勾选 “Add Python to PATH”。
    echo.
    pause
    exit /b 1
)

set /a PORT=8000

:find_port
if !PORT! GTR 8099 goto no_port

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "$port=!PORT!; $client=New-Object Net.Sockets.TcpClient; try{$client.Connect('127.0.0.1',$port); $occupied=$true}catch{$occupied=$false}finally{$client.Dispose()}; if(-not $occupied){exit 0}; try{$page=Invoke-WebRequest ('http://127.0.0.1:'+ $port +'/') -UseBasicParsing -TimeoutSec 1; if($page.Content -match '<title>PKUscore'){exit 2}}catch{}; exit 1" >nul 2>nul

set "PORT_STATE=!errorlevel!"
if "!PORT_STATE!"=="0" goto port_ready
if "!PORT_STATE!"=="2" goto already_running

set /a PORT+=1
goto find_port

:already_running
echo.
echo PKUscore 已在 http://127.0.0.1:!PORT!/ 运行。
start "" "http://127.0.0.1:!PORT!/"
exit /b 0

:port_ready
echo.
echo PKUscore 正在启动：http://127.0.0.1:!PORT!/
echo 浏览器将在服务就绪后自动打开。
echo.
echo 请保留此窗口；关闭窗口或按 Ctrl+C 即可停止 PKUscore。
echo.

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command ^
    "$url='http://127.0.0.1:!PORT!/'; for($i=0;$i -lt 100;$i++){try{Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 1 | Out-Null; Start-Process $url; exit}catch{Start-Sleep -Milliseconds 100}}"

%PYTHON_CMD% app.py --port !PORT!
set "SERVER_EXIT=!errorlevel!"

if not "!SERVER_EXIT!"=="0" (
    echo.
    echo [错误] PKUscore 服务异常退出，错误代码：!SERVER_EXIT!
    echo.
    pause
)
exit /b !SERVER_EXIT!

:no_port
echo.
echo [错误] 8000 到 8099 端口均已被占用。
echo 请关闭部分本地服务后重试。
echo.
pause
exit /b 1
