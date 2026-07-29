@echo off
cd /d "C:\Users\Usuario\Projects\aplidec-clon"
echo Iniciando servidor en http://localhost:8000
echo Presiona Ctrl+C para detener
python -m http.server 8000
pause
