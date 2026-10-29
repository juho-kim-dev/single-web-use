@echo off
node "%~dp0..\src\cli.js" start --browser
if errorlevel 1 pause
