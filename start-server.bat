@echo off
cd /d "%~dp0"
echo.
echo ========== 电脑本机 ==========
echo   http://127.0.0.1:8765/
echo.
echo ========== 手机（同一 WiFi / 手机热点）==========
echo   请看下面的 IPv4，手机浏览器打开:
echo   http://这里的IP:8765/
echo.
ipconfig | findstr /i "IPv4"
echo.
echo 关掉本窗口 = 关掉网站。手机和电脑要在同一网络。
echo.
start "" "http://127.0.0.1:8765/"
python -m http.server 8765 --bind 0.0.0.0
pause
