#!/bin/bash
# ============================================
# Video2Shorts — Установка (Linux/Mac)
# ============================================

set -e

echo "🎬 Video2Shorts — Установка"
echo "=============================="
echo ""

# Проверка Python
echo "📋 Проверка Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
        echo "❌ Требуется Python 3.10+. У вас: $PYTHON_VERSION"
        exit 1
    fi
    echo "✅ Python $PYTHON_VERSION"
else
    echo "❌ Python3 не найден. Установите Python 3.10+"
    exit 1
fi

# Проверка FFmpeg
echo ""
echo "📋 Проверка FFmpeg..."
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n1)
    echo "✅ $FFMPEG_VERSION"
else
    echo "⚠️  FFmpeg не найден!"
    echo "   Установка:"
    echo "   - Ubuntu/Debian: sudo apt install ffmpeg"
    echo "   - macOS: brew install ffmpeg"
    echo "   - Arch: sudo pacman -S ffmpeg"
    read -p "   Продолжить без FFmpeg? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Проверка CUDA (опционально)
echo ""
echo "📋 Проверка CUDA..."
if command -v nvidia-smi &> /dev/null; then
    echo "✅ NVIDIA GPU обнаружен:"
    nvidia-smi --query-gpu=name,driver_version --format=csv,noheader
else
    echo "⚠️  NVIDIA GPU не обнаружен. Будет использоваться CPU."
    echo "   Для GPU-ускорения установите CUDA Toolkit и драйверы NVIDIA."
fi

# Проверка Ollama
echo ""
echo "📋 Проверка Ollama..."
if command -v ollama &> /dev/null; then
    echo "✅ Ollama установлен"
    # Проверяем запущен ли сервис
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama сервис запущен"
    else
        echo "⚠️  Ollama сервис не запущен. Запустите: ollama serve"
    fi
else
    echo "⚠️  Ollama не установлен!"
    echo "   Установка: curl -fsSL https://ollama.com/install.sh | sh"
    echo "   Без Ollama будет использоваться fallback-алгоритм для поиска хайлайтов."
fi

# Создание виртуального окружения
echo ""
echo "📦 Создание виртуального окружения..."
python3 -m venv venv
source venv/bin/activate

# Обновление pip
echo "📦 Обновление pip..."
pip install --upgrade pip

# Установка зависимостей
echo ""
echo "📦 Установка Python-зависимостей..."
pip install -r requirements.txt

# Скачивание моделей
echo ""
echo "📦 Предзагрузка моделей..."

# Whisper модель будет скачана при первом запуске
echo "  - Whisper модель будет скачана при первом запуске"

# YOLOv8 модель
python3 -c "
from ultralytics import YOLO
print('  - Скачивание YOLOv8n...')
model = YOLO('yolov8n.pt')
print('  ✅ YOLOv8n загружена')
"

# Ollama модели
if command -v ollama &> /dev/null; then
    echo ""
    echo "📦 Скачивание LLM модели (может занять время)..."
    read -p "   Скачать qwen2.5:14b? (~9GB) (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ollama pull qwen2.5:14b
        echo "  ✅ Модель qwen2.5:14b загружена"
    else
        echo "  Пропуск. Модель можно скачать позже: ollama pull qwen2.5:14b"
    fi
fi

echo ""
echo "=============================="
echo "✅ Установка завершена!"
echo ""
echo "Запуск:"
echo "  source venv/bin/activate"
echo "  python main.py --input ./videos/ --output ./clips/"
echo ""
echo "Тестовый запуск (без рендеринга):"
echo "  python main.py --input video.mp4 --dry-run"
echo "=============================="
