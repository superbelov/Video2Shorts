import { useState } from 'react';

// Code snippets for the viewer
const codeSnippets: Record<string, { language: string; code: string; description: string }> = {
  main: {
    language: 'python',
    description: 'main.py — Оркестратор пайплайна',
    code: `#!/usr/bin/env python3
"""
Video2Shorts — Главный оркестратор пайплайна.
Связывает все модули в единый процесс.
"""

import argparse
import logging
import json
import time
from pathlib import Path

from transcriber import Transcriber
from highlight_finder import HighlightFinder
from face_tracker import FaceTracker
from video_renderer import VideoRenderer


class PipelineState:
    """Управление состоянием для возобновления."""

    def __init__(self, cache_dir: str):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def is_completed(self, video_path: str) -> bool:
        # Проверяем кэш по хешу файла
        ...

    def save_intermediate(self, video_path: str, stage: str, data: dict):
        # Сохраняем промежуточные результаты
        ...


def process_video(video_path, output_dir, config, state, dry_run=False):
    """Обработка одного видео через весь пайплайн."""

    # ЭТАП 1: Транскрибация
    transcriber = Transcriber(
        model_size=config['transcription']['model'],
        language=config['transcription']['language'],
        device=config['transcription']['device']
    )
    transcript = transcriber.transcribe(video_path, output_dir)

    # ЭТАП 2: Поиск хайлайтов через LLM
    finder = HighlightFinder(
        ollama_url=config['llm']['ollama_url'],
        model=config['llm']['model']
    )
    highlights = finder.find_highlights(transcript)

    # ЭТАП 3: Трекинг лица
    tracker = FaceTracker(
        model_path=config['tracking']['model'],
        smoothing_method=config['tracking']['smoothing']
    )
    tracking_data = tracker.track(video_path)

    # ЭТАП 4: Рендеринг вертикальных клипов
    renderer = VideoRenderer(
        output_width=config['render']['width'],
        output_height=config['render']['height'],
        fps=config['render']['fps']
    )

    for highlight in highlights:
        renderer.render_clip(
            input_video=video_path,
            output_path=f"clip_{highlight['start']}.mp4",
            start_time=highlight['start'],
            end_time=highlight['end'],
            tracking_data=tracking_data
        )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Video2Shorts')
    parser.add_argument('--input', '-i', required=True)
    parser.add_argument('--output', '-o', default='./clips/')
    parser.add_argument('--config', '-c', default='config.yaml')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    # ...`
  },
  transcriber: {
    language: 'python',
    description: 'transcriber.py — Транскрибация через faster-whisper',
    code: `#!/usr/bin/env python3
"""
Модуль транскрибации аудио через faster-whisper.
Поддержка русского языка, генерация .srt и .json.
"""

from faster_whisper import WhisperModel


class Transcriber:
    def __init__(self, model_size='medium', language='ru',
                 device='auto', compute_type='float16'):
        self.model_size = model_size
        self.language = language
        self.device = device
        self.compute_type = compute_type
        self.model = None

    def _load_model(self):
        """Ленивая загрузка модели faster-whisper."""
        if self.model is not None:
            return

        # Автоопределение устройства
        if self.device == 'auto':
            import torch
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'

        if self.device == 'cpu':
            self.compute_type = 'int8'

        self.model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type
        )

    def transcribe(self, video_path, output_dir='.', max_chunk_seconds=300):
        """Транскрибация видеофайла."""
        self._load_model()

        # Извлечение аудио через FFmpeg
        audio_path = self._extract_audio(video_path)

        # Транскрибация с пословными таймкодами
        segments, info = self.model.transcribe(
            audio_path,
            language=self.language,
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200
            )
        )

        # Формирование результата
        all_segments = []
        all_words = []

        for segment in segments:
            all_segments.append({
                'start': segment.start,
                'end': segment.end,
                'text': segment.text.strip()
            })

            if segment.words:
                for word in segment.words:
                    all_words.append({
                        'word': word.word.strip(),
                        'start': word.start,
                        'end': word.end,
                        'probability': round(word.probability, 3)
                    })

        # Генерация SRT и JSON
        self._generate_srt(all_segments, srt_path)
        self._save_json(result, json_path)

        return result

    def _generate_srt(self, segments, output_path):
        """Генерация SRT файла из сегментов."""
        def format_srt_time(seconds):
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int((seconds % 1) * 1000)
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

        with open(output_path, 'w', encoding='utf-8') as f:
            for i, segment in enumerate(segments, 1):
                f.write(f"{i}\\n")
                f.write(f"{format_srt_time(segment['start'])} --> "
                        f"{format_srt_time(segment['end'])}\\n")
                f.write(f"{segment['text']}\\n\\n")`
  },
  highlight: {
    language: 'python',
    description: 'highlight_finder.py — Поиск хайлайтов через LLM',
    code: `#!/usr/bin/env python3
"""
Поиск вирусных фрагментов через локальную LLM (Ollama).
Анализирует транскрипт и находит 3-5 лучших фрагментов.
"""

import json
import re
import requests


HIGHLIGHT_PROMPT = """Ты — эксперт по созданию вирусных коротких видео.

Проанализируй транскрипт и найди {num_highlights} вирусных фрагментов.

КРИТЕРИИ:
1. ХУК В НАЧАЛЕ — первые 3-5 секунд цепляют
2. ЭМОЦИЯ — удивление, смех, возмущение
3. ЗАКОНЧЕННАЯ МЫСЛЬ — понятна без контекста
4. ДЛИНА — от {min_duration} до {max_duration} секунд

ТРАНСКРИПТ:
---
{transcript}
---

ВЕРНИ JSON:
[
  {{"start": 120.5, "end": 165.0,
    "reason": "Вирусный хук про...",
    "score": 8.5}}
]
"""


class HighlightFinder:
    def __init__(self, ollama_url='http://localhost:11434',
                 model='qwen2.5:14b', min_duration=30,
                 max_duration=60, num_highlights=5):
        self.ollama_url = ollama_url
        self.model = model
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.num_highlights = num_highlights

    def _call_ollama(self, prompt: str) -> str:
        """Вызов Ollama API."""
        url = f"{self.ollama_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3}
        }
        response = requests.post(url, json=payload, timeout=300)
        return response.json().get('response', '')

    def _parse_llm_response(self, response: str) -> list:
        """Парсинг JSON из ответа LLM."""
        json_match = re.search(r'\\[[\\s\\S]*\\]', response)
        if not json_match:
            return self._fallback_find_highlights()

        highlights = json.loads(json_match.group())

        # Валидация и удаление пересечений
        validated = []
        for h in highlights:
            duration = h['end'] - h['start']
            if self.min_duration <= duration <= self.max_duration:
                validated.append(h)

        return self._remove_overlaps(validated)

    def find_highlights(self, transcript_data: dict) -> list:
        """Основной метод поиска хайлайтов."""
        segments = transcript_data.get('segments', [])
        transcript_text = self._segments_to_text(segments)

        prompt = HIGHLIGHT_PROMPT.format(
            num_highlights=self.num_highlights,
            min_duration=self.min_duration,
            max_duration=self.max_duration,
            transcript=transcript_text[:15000]
        )

        try:
            response = self._call_ollama(prompt)
            return self._parse_llm_response(response)
        except Exception:
            return self._fallback_find_highlights(segments)`
  },
  tracker: {
    language: 'python',
    description: 'face_tracker.py — Трекинг лица + фильтр Калмана',
    code: `#!/usr/bin/env python3
"""
Трекинг лица/спикера через YOLOv8.
Фильтр Калмана для сглаживания координат.
"""

import cv2
import numpy as np
from ultralytics import YOLO


class KalmanFilter2D:
    """Фильтр Калмана для сглаживания 2D координат."""

    def __init__(self, process_noise=1.0, measurement_noise=1.0):
        # Состояние: [x, y, vx, vy]
        self.state = np.array([0.0, 0.0, 0.0, 0.0])

        # Матрица перехода
        self.F = np.array([
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ], dtype=np.float64)

        # Матрица измерения
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ], dtype=np.float64)

        self.P = np.eye(4) * 1000  # Ковариация
        self.Q = np.eye(4) * process_noise
        self.R = np.eye(2) * measurement_noise
        self.initialized = False

    def update(self, measurement):
        """Обновление фильтра новым измерением."""
        z = np.array(measurement, dtype=np.float64)

        if not self.initialized:
            self.state[:2] = z
            self.initialized = True
            return tuple(self.state[:2])

        # Prediction
        self.state = self.F @ self.state
        self.P = self.F @ self.P @ self.F.T + self.Q

        # Update (Kalman gain)
        y = z - self.H @ self.state
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)

        self.state = self.state + K @ y
        self.P = (np.eye(4) - K @ self.H) @ self.P

        return tuple(self.state[:2])


class FaceTracker:
    def __init__(self, model_path='yolov8n.pt',
                 smoothing_method='kalman', smoothing_window=15):
        self.model = YOLO(model_path)
        self.smoothing_method = smoothing_method
        self.smoothing_window = smoothing_window

    def track(self, video_path: str) -> dict:
        """Трекинг на всём видео."""
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        smoother = KalmanFilter2D(process_noise=2.0, measurement_noise=5.0)
        frames_data = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Детекция людей через YOLOv8
            results = self.model(frame, verbose=False, conf=0.5)
            persons = self._extract_persons(results)

            # Выбор спикера (крупнейший / с лицом)
            speaker = self._select_speaker(persons, frame)

            if speaker:
                raw_x, raw_y = speaker['center']
            else:
                raw_x, raw_y = width / 2, height / 2

            # Сглаживание через Калман
            smooth_x, smooth_y = smoother.update(raw_x, raw_y)

            frames_data.append({
                'timestamp': frame_idx / fps,
                'raw_x': raw_x,
                'raw_y': raw_y,
                'smooth_x': smooth_x,
                'smooth_y': smooth_y
            })

        return {'frames': frames_data, 'width': width, 'height': height}`
  },
  renderer: {
    language: 'python',
    description: 'video_renderer.py — Рендеринг через FFmpeg',
    code: `#!/usr/bin/env python3
"""
Рендеринг вертикальных клипов через FFmpeg.
Динамический кроп 9:16 + burn-in субтитры.
"""

import subprocess
import os


class VideoRenderer:
    def __init__(self, output_width=1080, output_height=1920,
                 fps=30, subtitle_style=None):
        self.output_width = output_width
        self.output_height = output_height
        self.fps = fps
        self.subtitle_style = subtitle_style or {
            'font': 'Arial',
            'fontsize': 42,
            'fontcolor': 'white',
            'outline': 3,
            'shadow': 2,
            'margin_v': 150,
            'bold': 1
        }

    def _build_crop_filter(self, input_w, input_h, tracking_data):
        """Фильтр динамического кропа 9:16."""
        crop_width = int(input_h * 9 / 16)
        crop_width = min(crop_width, input_w)
        max_x = max(0, input_w - crop_width)

        if not tracking_data:
            x_pos = max_x // 2
            return f"crop={crop_width}:{input_h}:{x_pos}:0"

        # Динамическое смещение по X
        speaker_x = tracking_data[0].get('smooth_x', input_w / 2)
        x_pos = int(speaker_x - crop_width / 2)
        x_pos = max(0, min(x_pos, max_x))

        return f"crop={crop_width}:{input_h}:{x_pos}:0"

    def _build_subtitle_filter(self, srt_path):
        """Фильтр субтитров с кастомным стилем."""
        if not srt_path or not os.path.exists(srt_path):
            return ""

        style = self.subtitle_style
        force_style = (
            f"FontName={style['font']},"
            f"FontSize={style['fontsize']},"
            f"PrimaryColour=&H00FFFFFF,"
            f"OutlineColour=&H00000000,"
            f"BorderStyle=1,"
            f"Outline={style['outline']},"
            f"Shadow={style['shadow']},"
            f"Bold={style['bold']}"
        )

        escaped = srt_path.replace('\\\\', '/').replace(':', '\\\\:')
        return f"subtitles='{escaped}':force_style='{force_style}'"

    def render_clip(self, input_video, output_path,
                    start_time, end_time, tracking_data, srt_path=None):
        """Рендеринг одного вертикального клипа."""
        video_info = self._get_video_info(input_video)

        # Цепочка фильтров
        filters = []
        filters.append(self._build_crop_filter(
            video_info['width'], video_info['height'], tracking_data))
        filters.append(
            f"scale={self.output_width}:{self.output_height}")

        if srt_path:
            sub = self._build_subtitle_filter(srt_path)
            if sub:
                filters.append(sub)

        filter_chain = ','.join(filters)

        cmd = [
            'ffmpeg',
            '-ss', str(start_time),
            '-i', input_video,
            '-t', str(end_time - start_time),
            '-vf', filter_chain,
            '-r', str(self.fps),
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y', output_path
        ]

        subprocess.run(cmd, check=True, capture_output=True)`
  },
  config: {
    language: 'yaml',
    description: 'config.yaml — Конфигурация пайплайна',
    code: `# Video2Shorts — Конфигурация
# ============================

# Транскрибация аудио
transcription:
  model: "medium"           # tiny/base/small/medium/large-v3
  language: "ru"            # Язык распознавания
  device: "auto"            # auto/cuda/cpu
  compute_type: "float16"   # float16 (GPU) / int8 (CPU)
  max_chunk_minutes: 5      # Разбиение длинных видео

# LLM для поиска хайлайтов
llm:
  ollama_url: "http://localhost:11434"
  model: "qwen2.5:14b"     # qwen2.5:14b / llama3:8b
  temperature: 0.3

# Параметры хайлайтов
highlights:
  count: 5                  # Количество клипов
  min_duration: 30          # Мин. длина (сек)
  max_duration: 60          # Макс. длина (сек)

# Трекинг лица
tracking:
  model: "yolov8n.pt"       # Модель YOLOv8
  smoothing: "kalman"       # kalman / moving_average
  smoothing_window: 15      # Окно сглаживания
  confidence_threshold: 0.5

# Рендеринг
render:
  width: 1080               # Выходная ширина
  height: 1920              # Выходная высота (9:16)
  fps: 30                   # Частота кадров
  crf: 18                   # Качество (18-28)
  subtitle_style:
    font: "Arial"
    fontsize: 42
    fontcolor: "white"
    outline: 3
    shadow: 2
    bold: 1

# Кэширование
cache_dir: "./cache/"`
  }
};

function App() {
  const [activeTab, setActiveTab] = useState('main');
  const [activeSection, setActiveSection] = useState('hero');

  const tabs = [
    { id: 'main', label: 'main.py', icon: '🎬' },
    { id: 'transcriber', label: 'transcriber.py', icon: '🎙️' },
    { id: 'highlight', label: 'highlight_finder.py', icon: '🧠' },
    { id: 'tracker', label: 'face_tracker.py', icon: '👤' },
    { id: 'renderer', label: 'video_renderer.py', icon: '🎞️' },
    { id: 'config', label: 'config.yaml', icon: '⚙️' },
  ];

  const features = [
    {
      icon: '🎙️',
      title: 'Транскрибация',
      desc: 'faster-whisper с поддержкой русского языка. Генерация .srt и .json с пословными таймкодами.'
    },
    {
      icon: '🧠',
      title: 'AI-хайлайты',
      desc: 'Поиск вирусных фрагментов через локальную LLM (Ollama + qwen2.5/llama3).'
    },
    {
      icon: '👤',
      title: 'Трекинг лица',
      desc: 'YOLOv8 + фильтр Калмана для плавного слежения за спикером без дрожания.'
    },
    {
      icon: '🎞️',
      title: 'Рендеринг 9:16',
      desc: 'FFmpeg с динамическим кропом, burn-in субтитрами и кастомным стилем.'
    },
    {
      icon: '📦',
      title: 'Пакетная обработка',
      desc: 'Рекурсивный обход папок, прогресс-бары, кэширование и возобновление.'
    },
    {
      icon: '🔧',
      title: 'Dry-run режим',
      desc: 'Тестирование пайплайна без рендеринга — проверка хайлайтов и координат.'
    },
  ];

  const pipelineSteps = [
    { step: 1, title: 'Транскрибация', desc: 'faster-whisper', color: 'from-blue-500 to-blue-600', icon: '🎙️' },
    { step: 2, title: 'AI Анализ', desc: 'Ollama LLM', color: 'from-purple-500 to-purple-600', icon: '🧠' },
    { step: 3, title: 'Трекинг', desc: 'YOLOv8 + Kalman', color: 'from-green-500 to-green-600', icon: '👤' },
    { step: 4, title: 'Рендеринг', desc: 'FFmpeg', color: 'from-orange-500 to-orange-600', icon: '🎞️' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg flex items-center justify-center text-sm font-bold">
                V
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                Video2Shorts
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Возможности</a>
              <a href="#pipeline" className="text-sm text-gray-400 hover:text-white transition-colors">Пайплайн</a>
              <a href="#code" className="text-sm text-gray-400 hover:text-white transition-colors">Код</a>
              <a href="#install" className="text-sm text-gray-400 hover:text-white transition-colors">Установка</a>
              <a
                href="/python-project/README.md"
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-pink-600 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Документация
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-full text-sm text-gray-300 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Python 3.10+ • FFmpeg • GPU Ready
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              Длинные видео →
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Вирусные шортсы
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Автоматическая конвертация горизонтальных видео в вертикальные ролики 9:16
            для TikTok, Instagram Reels и VK Клипов. AI-поиск хайлайтов, трекинг лица,
            burn-in субтитры — всё в одном пайплайне.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#install"
              className="px-8 py-4 bg-gradient-to-r from-violet-600 to-pink-600 rounded-xl text-lg font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
            >
              🚀 Начать установку
            </a>
            <a
              href="#code"
              className="px-8 py-4 bg-gray-800 border border-gray-700 rounded-xl text-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              📖 Смотреть код
            </a>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto">
            {[
              { value: '5', label: 'Модулей' },
              { value: '9:16', label: 'Формат' },
              { value: '1080p', label: 'Разрешение' },
              { value: '0₽', label: 'Без лимитов' },
            ].map((stat, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                Полный пайплайн
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              От длинного видео до готовых вертикальных клипов — полностью автоматически
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-violet-500/50 hover:bg-gray-900/80 transition-all duration-300"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-violet-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline Section */}
      <section id="pipeline" className="py-20 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                Как это работает
              </span>
            </h2>
            <p className="text-gray-400 text-lg">
              4 этапа — от исходного видео до готовых клипов
            </p>
          </div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 via-green-500 to-orange-500 -translate-y-1/2"></div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {pipelineSteps.map((step, i) => (
                <div key={i} className="relative">
                  <div className={`bg-gradient-to-br ${step.color} rounded-2xl p-6 text-center relative z-10 shadow-xl`}>
                    <div className="text-4xl mb-3">{step.icon}</div>
                    <div className="text-sm font-medium text-white/70 mb-1">Этап {step.step}</div>
                    <h3 className="text-xl font-bold mb-1">{step.title}</h3>
                    <p className="text-white/80 text-sm">{step.desc}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-4 w-8 h-8 bg-gray-950 rounded-full items-center justify-center z-20 -translate-y-1/2">
                      <span className="text-gray-400">→</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Technical details */}
          <div className="mt-16 grid md:grid-cols-2 gap-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-green-400">✓</span> Входные данные
              </h3>
              <ul className="space-y-2 text-gray-400">
                <li>• Горизонтальное видео (любое разрешение)</li>
                <li>• Форматы: MP4, AVI, MKV, MOV, WebM</li>
                <li>• Любой язык (по умолчанию русский)</li>
                <li>• Длительность: от 1 минуты до часов</li>
              </ul>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-green-400">✓</span> Выходные данные
              </h3>
              <ul className="space-y-2 text-gray-400">
                <li>• Вертикальные клипы 1080×1920 (9:16)</li>
                <li>• 30fps, H.264 + AAC</li>
                <li>• Burn-in субтитры с обводкой</li>
                <li>• Динамический кроп по спикеру</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Code Viewer Section */}
      <section id="code" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
                Исходный код
              </span>
            </h2>
            <p className="text-gray-400 text-lg">
              Модульная архитектура — каждый файл отвечает за свою задачу
            </p>
          </div>

          {/* Tab navigation */}
          <div className="flex flex-wrap gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Code display */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-3 text-sm text-gray-400">
                  {codeSnippets[activeTab].description}
                </span>
              </div>
              <span className="text-xs text-gray-500 uppercase">
                {codeSnippets[activeTab].language}
              </span>
            </div>
            <div className="p-6 overflow-x-auto max-h-[600px] overflow-y-auto">
              <pre className="text-sm leading-relaxed">
                <code className="text-gray-300 font-mono whitespace-pre">
                  {codeSnippets[activeTab].code}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Installation Section */}
      <section id="install" className="py-20 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Установка и запуск
              </span>
            </h2>
            <p className="text-gray-400 text-lg">
              Три команды — и готово к работе
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {/* Step 1 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center font-bold text-lg shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Клонирование и установка</h3>
                  <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm">
                    <div className="text-green-400">$ git clone https://github.com/your-username/video2shorts.git</div>
                    <div className="text-green-400">$ cd video2shorts</div>
                    <div className="text-green-400 mt-2">$ chmod +x install.sh && ./install.sh</div>
                    <div className="text-gray-500 mt-1"># или для Windows: install.bat</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Запуск Ollama (для AI-хайлайтов)</h3>
                  <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm">
                    <div className="text-green-400">$ ollama serve &</div>
                    <div className="text-green-400">$ ollama pull qwen2.5:14b</div>
                    <div className="text-gray-500 mt-1"># Без Ollama будет использоваться fallback-алгоритм</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-pink-600 rounded-xl flex items-center justify-center font-bold text-lg shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Конвертация видео!</h3>
                  <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm">
                    <div className="text-gray-500"># Тестовый запуск (без рендеринга)</div>
                    <div className="text-green-400">$ python main.py --input video.mp4 --dry-run</div>
                    <div className="text-gray-500 mt-3"># Полная обработка</div>
                    <div className="text-green-400">$ python main.py --input ./videos/ --output ./clips/</div>
                    <div className="text-gray-500 mt-3"># С кастомной конфигурацией</div>
                    <div className="text-green-400">$ python main.py -i video.mp4 -o ./clips/ -c config.yaml</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="mt-12 max-w-4xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">📋 Системные требования</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Обязательные:</h4>
                  <ul className="space-y-1 text-sm text-gray-400">
                    <li>• Python 3.10+</li>
                    <li>• FFmpeg 5.0+</li>
                    <li>• 8 GB RAM</li>
                    <li>• 10 GB свободного места</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Рекомендуемые:</h4>
                  <ul className="space-y-1 text-sm text-gray-400">
                    <li>• NVIDIA GPU (6GB+ VRAM)</li>
                    <li>• 16+ GB RAM</li>
                    <li>• Ollama + qwen2.5:14b</li>
                    <li>• SSD для кэша</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Архитектура
              </span>
            </h2>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                {/* Input */}
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">📹</div>
                  <div className="text-sm font-medium">Видео</div>
                  <div className="text-xs text-gray-500">MP4, AVI, MKV</div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex justify-center text-gray-600 text-2xl">→</div>

                {/* Pipeline */}
                <div className="bg-gradient-to-br from-violet-900/50 to-pink-900/50 border border-violet-500/30 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">⚡</div>
                  <div className="text-sm font-medium">Пайплайн</div>
                  <div className="text-xs text-gray-400 mt-1">
                    <div>transcriber → highlight</div>
                    <div>→ tracker → renderer</div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex justify-center text-gray-600 text-2xl">→</div>

                {/* Output */}
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">📱</div>
                  <div className="text-sm font-medium">Клипы 9:16</div>
                  <div className="text-xs text-gray-500">1080×1920, 30fps</div>
                </div>
              </div>

              {/* Module details */}
              <div className="mt-8 grid md:grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-violet-300 mb-2">📁 Структура файлов</h4>
                  <div className="font-mono text-xs text-gray-400 space-y-1">
                    <div>├── main.py <span className="text-gray-600"># оркестратор</span></div>
                    <div>├── transcriber.py <span className="text-gray-600"># whisper</span></div>
                    <div>├── highlight_finder.py <span className="text-gray-600"># LLM</span></div>
                    <div>├── face_tracker.py <span className="text-gray-600"># YOLOv8</span></div>
                    <div>├── video_renderer.py <span className="text-gray-600"># FFmpeg</span></div>
                    <div>├── config.yaml <span className="text-gray-600"># настройки</span></div>
                    <div>├── install.sh <span className="text-gray-600"># установка</span></div>
                    <div>└── requirements.txt</div>
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-green-300 mb-2">🔧 Ключевые технологии</h4>
                  <div className="space-y-2">
                    {[
                      { name: 'faster-whisper', desc: 'Транскрибация' },
                      { name: 'ultralytics YOLOv8', desc: 'Детекция людей' },
                      { name: 'Kalman Filter', desc: 'Сглаживание координат' },
                      { name: 'FFmpeg', desc: 'Видео-рендеринг' },
                      { name: 'Ollama', desc: 'Локальная LLM' },
                    ].map((tech, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                        <span className="text-gray-300 font-medium">{tech.name}</span>
                        <span className="text-gray-500">— {tech.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg flex items-center justify-center text-sm font-bold">
                V
              </div>
              <span className="font-bold">Video2Shorts</span>
              <span className="text-gray-500 text-sm">— AI-powered video converter</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>MIT License</span>
              <span>•</span>
              <span>Python 3.10+</span>
              <span>•</span>
              <span>No watermarks</span>
              <span>•</span>
              <span>No limits</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
