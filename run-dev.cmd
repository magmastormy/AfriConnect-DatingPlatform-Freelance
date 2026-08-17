@echo off
REM AfriConnect dev launcher — starts API (port 4000) + Web (port 3000) together.
REM Double-click this file, or run:  run-dev.cmd   (native Windows cmd)
cd /d %~dp0

echo ==^> AfriConnect dev launcher
echo     API : http://localhost:4000
echo     WEB : http://localhost:3000
echo     Ctrl+C stops BOTH.
echo(

where pnpm >nul 2>nul
if %errorlevel%==0 (
  pnpm dev
) else (
  where npm >nul 2>nul
  if %errorlevel%==0 (
    npx turbo run dev
  ) else (
    echo ERROR: neither pnpm nor npm found on PATH.
    exit /b 1
  )
)
