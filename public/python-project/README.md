# 🎬 Video2Shorts

**Автоматическая конвертация длинных горизонтальных видео в короткие вертикальные ролики (9:16) для TikTok, Instagram Reels и VK Клипов.**

![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue)
![FFmpeg](https://img.shields.io/badge/FFmpeg-required-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🚀 Возможности

- 🎙️ **Транскрибация** — распознавание речи через faster-whisper (поддержка русского языка)
- 🧠 **AI-хайлайты** — поиск вирусных фрагментов через локальную LLM (Ollama)
- 👤 **Трекинг лица** — автоматическое слежение за спикером (YOLOv8 + фильтр Калмана)
- 🎞️ **Рендеринг** — вертикальный кроп 9:16 с burn-in субтитрами через FFmpeg
- 📦 **Пакетная обработка** — рекурсивная обработка папок с видео
- 💾 **Кэширование** — возможность прервать и возобновить обработку
- 🔧 **Dry-run** — тестирование без рендеринга

## 📋 Системные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| Python | 3.10 | 3.11+ |
| RAM | 8 GB | 16+ GB |
| GPU | — | NVIDIA 6GB+ VRAM |
| Диск | 10 GB | 20+ GB |
| FFmpeg | 5.0+ | 6.0+ |

### Опционально (для GPU-ускорения):
- NVIDIA драйвер 525+
- CUDA Toolkit 12.0+
- cuDNN 8.9+

### Опционально (для AI-хайлайтов):
- Ollama (локальная LLM)
- Модель qwen2.5:14b или llama3:8b

## ⚡ Быстрый старт

### 1. Клонирование

```bash
git clone https://github.com/your-username/video2shorts.git
cd video2shorts
```

### 2. Установка

**Linux/Mac:**
```bash
chmod +x install.sh
./install.sh
```

**Windows:**
```batch
install.bat
```

### 3. Запуск

```bash
# Активация окружения
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate     # Windows

# Обработка одного видео
python main.py --input video.mp4 --output ./clips/

# Обработка папки с видео
python main.py --input ./my_videos/ --output ./clips/

# Тестовый запуск (без рендеринга)
python main.py --input video.mp4 --dry-run

# С кастомной конфигурацией
python main.py --input video.mp4 --config my_config.yaml
```

## 📁 Структура проекта

```
video2shorts/
├── main.py              # Оркестратор пайплайна
├── transcriber.py       # Транскрибация (faster-whisper)
├── highlight_finder.py  # Поиск хайлайтов (LLM)
├── face_tracker.py      # Трекинг лица (YOLOv8 + Kalman)
├── video_renderer.py    # Рендеринг (FFmpeg)
├── config.yaml          # Конфигурация
├── requirements.txt     # Python-зависимости
├── install.sh           # Установка (Linux/Mac)
├── install.bat          # Установка (Windows)
├── test_transcriber.py  # Тест транскрибации
├── test_tracker.py      # Тест трекинга
└── README.md            # Документация
```

## ⚙️ Конфигурация

Все параметры настраиваются через `config.yaml`:

```yaml
# Модель Whisper для транскрибации
transcription:
  model: "medium"        # tiny/base/small/medium/large-v3
  language: "ru"         # Язык распознавания
  device: "auto"         # auto/cuda/cpu

# LLM для поиска хайлайтов
llm:
  ollama_url: "http://localhost:11434"
  model: "qwen2.5:14b"  # Модель Ollama

# Параметры хайлайтов
highlights:
  count: 5               # Количество клипов
  min_duration: 30       # Мин. длина (сек)
  max_duration: 60       # Макс. длина (сек)

# Трекинг
tracking:
  model: "yolov8n.pt"    # Модель YOLO
  smoothing: "kalman"    # kalman/moving_average

# Рендеринг
render:
  width: 1080
  height: 1920
  fps: 30
```

## 🔧 Аргументы командной строки

```
python main.py [OPTIONS]

Обязательные:
  --input, -i PATH      Путь к видео или папке

Опциональные:
  --output, -o PATH     Выходная папка (по умолчанию: ./clips/)
  --config, -c PATH     Файл конфигурации (по умолчанию: config.yaml)
  --dry-run             Тест без рендеринга
  --resume              Возобновить с места прерывания
  --clear-cache         Очистить кэш
  --log-level LEVEL     DEBUG/INFO/WARNING/ERROR
```

## 🧪 Тестирование отдельных модулей

```bash
# Тест транскрибации
python test_transcriber.py --input video.mp4 --model medium

# Тест трекинга
python test_tracker.py --input video.mp4 --model yolov8n.pt
```

## 🐛 Troubleshooting

### Ошибка: "faster-whisper не установлен"
```bash
pip install faster-whisper
```

### Ошибка: "ultralytics не установлен"
```bash
pip install ultralytics
```

### Ошибка: "FFmpeg not found"
- **Ubuntu:** `sudo apt install ffmpeg`
- **macOS:** `brew install ffmpeg`
- **Windows:** Скачайте с [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) и добавьте в PATH

### Ошибка: "Ollama connection refused"
```bash
# Запустите Ollama
ollama serve

# В другом терминале скачайте модель
ollama pull qwen2.5:14b
```

### Ошибка: "CUDA out of memory"
- Используйте меньшую модель: `model: "small"` в config.yaml
- Или переключитесь на CPU: `device: "cpu"`

### Субтитры не отображаются
- Проверьте наличие шрифта Arial в системе
- Для Linux: `sudo apt install fonts-liberation`
- Укажите другой шрифт в config.yaml

### Видео обрабатывается очень медленно
- Используйте GPU: `device: "cuda"` в config.yaml
- Уменьшите модель: `model: "small"` или `model: "base"`
- Уменьшите `smoothing_window` для трекинга

## 📊 Как работает пайплайн

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Видео     │────▶│ Транскрибация│────▶│  Поиск     │────▶│  Трекинг    │
│  (input)    │     │ (Whisper)    │     │  хайлайтов  │     │  (YOLOv8)   │
└─────────────┘     └──────────────┘     │  (LLM)      │     └──────┬───────┘
                                          └──────────────┘            │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │  Рендеринг   │
                                                               │  (FFmpeg)    │
                                                               └──────┬───────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │  Клипы 9:16  │
                                                               │  (output)    │
                                                               └──────────────┘
```

## 📝 Лицензия

MIT License — используйте свободно.

## 🤝 Вклад

Pull requests приветствуются! Для крупных изменений сначала откройте issue.
