@echo off
cd /d "%~dp0"
echo Open: http://127.0.0.1:8080/
ipconfig | findstr IPv4
echo.
python -m http.server 8080
