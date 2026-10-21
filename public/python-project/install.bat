@echo off
REM ============================================
REM Video2Shorts — Установка (Windows)
REM ============================================

echo.
echo Video2Shorts — Установка
echo ==============================
echo.

REM Проверка Python
echo [1/5] Проверка Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo Python не найден! Установите Python 3.10+ с https://python.org
    echo ВАЖНО: При установке отметьте "Add Python to PATH"
    pause
    exit /b 1
)
python --version
echo OK

REM Проверка FFmpeg
echo.
echo [2/5] Проверка FFmpeg...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo FFmpeg не найден!
    echo Установка:
    echo   1. Скачайте с https://www.gyan.dev/ffmpeg/builds/
    echo   2. Распакуйте и добавьте bin/ в PATH
    echo   3. Или: winget install ffmpeg
    echo.
    set /p CONTINUE="Продолжить без FFmpeg? (y/n): "
    if /i not "%CONTINUE%"=="y" exit /b 1
) else (
    echo OK
)

REM Проверка NVIDIA GPU
echo.
echo [3/5] Проверка NVIDIA GPU...
nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo NVIDIA GPU не обнаружен. Будет использоваться CPU.
) else (
    nvidia-smi --query-gpu=name --format=csv,noheader
    echo OK
)

REM Создание виртуального окружения
echo.
echo [4/5] Создание виртуального окружения...
python -m venv venv
call venv\Scripts\activate.bat

REM Установка зависимостей
echo.
echo [5/5] Установка Python-зависимостей...
pip install --upgrade pip
pip install -r requirements.txt

REM Предзагрузка YOLOv8
echo.
echo Предзагрузка моделей...
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt'); print('YOLOv8 загружена')"

echo.
echo ==============================
echo Установка завершена!
echo.
echo Запуск:
echo   venv\Scripts\activate
echo   python main.py --input .\videos\ --output .\clips\
echo.
echo Тестовый запуск:
echo   python main.py --input video.mp4 --dry-run
echo ==============================
pause
