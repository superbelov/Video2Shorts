export const mainPy = `"""
Video2Shorts - Main Orchestrator
Автоматическая конвертация длинных видео в короткие вертикальные ролики.
"""

import os
import sys
import json
import logging
import argparse
import hashlib
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

import yaml
from tqdm import tqdm

from transcriber import Transcriber
from highlight_finder import HighlightFinder
from face_tracker import FaceTracker
from video_renderer import VideoRenderer

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('video2shorts.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


class Video2ShortsPipeline:
    """Основной пайплайн конвертации видео."""

    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.cache_dir = Path(self.config.get("cache_dir", "cache"))
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Инициализация модулей
        self.transcriber = Transcriber(self.config)
        self.highlight_finder = HighlightFinder(self.config)
        self.face_tracker = FaceTracker(self.config)
        self.video_renderer = VideoRenderer(self.config)

        logger.info("Pipeline initialized with config: %s", config_path)

    def _load_config(self, config_path: str) -> dict:
        """Загрузка конфигурации из YAML файла."""
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            logger.info("Config loaded from %s", config_path)
            return config
        except FileNotFoundError:
            logger.warning("Config file not found, using defaults")
            return self._default_config()

    def _default_config(self) -> dict:
        """Конфигурация по умолчанию."""
        return {
            "whisper_model": "medium",
            "whisper_language": "ru",
            "whisper_device": "auto",
            "llm_provider": "ollama",
            "llm_model": "qwen2.5",
            "llm_base_url": "http://localhost:11434",
            "yolo_model": "yolov8n.pt",
            "yolo_confidence": 0.5,
            "smoothing_window": 15,
            "output_resolution": [1080, 1920],
            "output_fps": 30,
            "output_codec": "libx264",
            "highlight_min_duration": 30,
            "highlight_max_duration": 60,
            "max_highlights": 5,
            "subtitle_font_size": 48,
            "subtitle_font_color": "white",
            "subtitle_outline_color": "black",
            "subtitle_outline_width": 3,
            "cache_dir": "cache",
            "split_threshold_minutes": 10,
            "split_duration_minutes": 5,
        }

    def _get_video_hash(self, video_path: Path) -> str:
        """Вычисление хеша файла для кэширования."""
        stat = video_path.stat()
        key = f"{video_path.name}_{stat.st_size}_{stat.st_mtime}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def _find_videos(self, input_path: str) -> List[Path]:
        """Рекурсивный поиск видеофайлов в директории."""
        video_extensions = {'.mp4', '.avi', '.mkv', '.mov', '.webm', '.flv', '.wmv'}
        path = Path(input_path)

        if path.is_file():
            if path.suffix.lower() in video_extensions:
                return [path]
            return []

        videos = []
        for ext in video_extensions:
            videos.extend(path.rglob(f"*{ext}"))
        videos.sort(key=lambda p: p.name)
        logger.info("Found %d video files in %s", len(videos), input_path)
        return videos

    def _is_cached(self, video_hash: str, stage: str) -> bool:
        """Проверка наличия кэша для этапа обработки."""
        cache_file = self.cache_dir / video_hash / f"{stage}.json"
        return cache_file.exists()

    def _load_cache(self, video_hash: str, stage: str) -> Optional[dict]:
        """Загрузка кэшированных данных."""
        cache_file = self.cache_dir / video_hash / f"{stage}.json"
        if cache_file.exists():
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def _save_cache(self, video_hash: str, stage: str, data: dict):
        """Сохранение данных в кэш."""
        cache_dir = self.cache_dir / video_hash
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = cache_dir / f"{stage}.json"
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def process_video(self, video_path: Path, output_dir: Path, dry_run: bool = False):
        """Обработка одного видеофайла."""
        video_hash = self._get_video_hash(video_path)
        logger.info("Processing: %s (hash: %s)", video_path.name, video_hash)

        # Этап 1: Транскрибация
        logger.info("=" * 50)
        logger.info("Stage 1: Transcription")
        logger.info("=" * 50)

        if self._is_cached(video_hash, "transcription"):
            logger.info("Using cached transcription")
            transcription = self._load_cache(video_hash, "transcription")
        else:
            with tqdm(desc="Transcribing", unit="segments") as pbar:
                transcription = self.transcriber.transcribe(
                    str(video_path),
                    progress_callback=lambda: pbar.update(1)
                )
            self._save_cache(video_hash, "transcription", transcription)

        logger.info("Transcription complete: %d segments", len(transcription.get("segments", [])))

        # Этап 2: Поиск хайлайтов
        logger.info("=" * 50)
        logger.info("Stage 2: Finding Highlights")
        logger.info("=" * 50)

        if self._is_cached(video_hash, "highlights"):
            logger.info("Using cached highlights")
            highlights = self._load_cache(video_hash, "highlights")
        else:
            highlights = self.highlight_finder.find_highlights(
                transcription,
                video_path=str(video_path)
            )
            self._save_cache(video_hash, "highlights", highlights)

        logger.info("Found %d highlights", len(highlights.get("highlights", [])))
        for i, h in enumerate(highlights.get("highlights", [])):
            logger.info(
                "  Highlight %d: %.1fs - %.1fs | %s",
                i + 1, h["start"], h["end"], h.get("reason", "N/A")
            )

        # Этап 3: Трекинг лица
        logger.info("=" * 50)
        logger.info("Stage 3: Face Tracking")
        logger.info("=" * 50)

        if self._is_cached(video_hash, "tracking"):
            logger.info("Using cached tracking data")
            tracking = self._load_cache(video_hash, "tracking")
        else:
            tracking = self.face_tracker.track(
                str(video_path),
                highlights=highlights.get("highlights", [])
            )
            self._save_cache(video_hash, "tracking", tracking)

        logger.info("Tracking complete for %d frames", len(tracking.get("frames", [])))

        if dry_run:
            logger.info("=" * 50)
            logger.info("DRY RUN - Skipping render")
            logger.info("=" * 50)
            self._log_dry_run_results(highlights, tracking)
            return

        # Этап 4: Рендер
        logger.info("=" * 50)
        logger.info("Stage 4: Rendering")
        logger.info("=" * 50)

        output_dir.mkdir(parents=True, exist_ok=True)
        test_dir = output_dir / "test_clips"
        test_dir.mkdir(parents=True, exist_ok=True)

        rendered_clips = []
        for i, highlight in enumerate(tqdm(highlights.get("highlights", []), desc="Rendering clips")):
            clip_name = f"{video_path.stem}_clip{i+1:02d}.mp4"
            clip_path = output_dir / clip_name

            # Рендер основного клипа
            self.video_renderer.render(
                input_video=str(video_path),
                output_path=str(clip_path),
                highlight=highlight,
                tracking_data=tracking,
                srt_path=transcription.get("srt_path", "")
            )
            rendered_clips.append(str(clip_path))

            # Рендер тестового клипа (первые 5 секунд)
            test_clip_path = test_dir / f"test_{clip_name}"
            test_highlight = highlight.copy()
            test_highlight["end"] = min(highlight["start"] + 5, highlight["end"])
            self.video_renderer.render(
                input_video=str(video_path),
                output_path=str(test_clip_path),
                highlight=test_highlight,
                tracking_data=tracking,
                srt_path=transcription.get("srt_path", "")
            )

        logger.info("=" * 50)
        logger.info("Processing complete!")
        logger.info("Rendered %d clips to %s", len(rendered_clips), output_dir)
        logger.info("Test clips saved to %s", test_dir)
        logger.info("=" * 50)

    def _log_dry_run_results(self, highlights: dict, tracking: dict):
        """Логирование результатов в режиме dry-run."""
        logger.info("\\n--- DRY RUN RESULTS ---")
        logger.info("\\nHighlights found:")
        for i, h in enumerate(highlights.get("highlights", [])):
            duration = h["end"] - h["start"]
            logger.info(
                "  %d. [%.1fs - %.1fs] (%.1fs) - %s",
                i + 1, h["start"], h["end"], duration, h.get("reason", "")
            )

        frames = tracking.get("frames", [])
        if frames:
            x_coords = [f["x"] for f in frames]
            y_coords = [f["y"] for f in frames]
            logger.info("\\nTracking stats:")
            logger.info("  Total frames: %d", len(frames))
            logger.info("  X range: %.1f - %.1f", min(x_coords), max(x_coords))
            logger.info("  Y range: %.1f - %.1f", min(y_coords), max(y_coords))
        logger.info("--- END DRY RUN ---\\n")

    def run(self, input_path: str, output_path: str, dry_run: bool = False):
        """Запуск пайплайна для всех найденных видео."""
        videos = self._find_videos(input_path)

        if not videos:
            logger.error("No video files found in: %s", input_path)
            return

        logger.info("Starting batch processing of %d videos", len(videos))
        output_dir = Path(output_path)

        for i, video in enumerate(tqdm(videos, desc="Processing videos")):
            logger.info("\\n[%d/%d] Processing: %s", i + 1, len(videos), video.name)
            try:
                self.process_video(video, output_dir / video.stem, dry_run)
            except Exception as e:
                logger.error("Error processing %s: %s", video.name, str(e))
                logger.exception("Full traceback:")
                continue

        logger.info("\\nBatch processing complete!")


def main():
    parser = argparse.ArgumentParser(
        description="Video2Shorts - Convert long videos to vertical shorts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --input ./videos/ --output ./clips/
  python main.py --input video.mp4 --output ./clips/ --dry-run
  python main.py --input ./videos/ --output ./clips/ --config my_config.yaml
        """
    )
    parser.add_argument("--input", "-i", required=True, help="Input video file or directory")
    parser.add_argument("--output", "-o", required=True, help="Output directory for clips")
    parser.add_argument("--config", "-c", default="config.yaml", help="Path to config file")
    parser.add_argument("--dry-run", action="store_true", help="Run pipeline without rendering")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    pipeline = Video2ShortsPipeline(args.config)
    pipeline.run(args.input, args.output, args.dry_run)


if __name__ == "__main__":
    main()
`;

export const transcriberPy = `"""
Transcriber Module
Транскрибация аудио через faster-whisper с поддержкой русского языка.
Генерация .srt субтитров и .json с пословными таймкодами.
"""

import os
import json
import logging
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Callable

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)


class Transcriber:
    """Модуль транскрибации аудио через faster-whisper."""

    def __init__(self, config: dict):
        self.model_size = config.get("whisper_model", "medium")
        self.language = config.get("whisper_language", "ru")
        self.device = config.get("whisper_device", "auto")
        self.cache_dir = Path(config.get("cache_dir", "cache"))
        self.split_threshold = config.get("split_threshold_minutes", 10)
        self.split_duration = config.get("split_duration_minutes", 5)

        self.model = None
        self._load_model()

    def _load_model(self):
        """Загрузка модели faster-whisper."""
        logger.info("Loading Whisper model: %s on %s", self.model_size, self.device)

        if self.device == "auto":
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                device = "cpu"
        else:
            device = self.device

        compute_type = "float16" if device == "cuda" else "int8"

        self.model = WhisperModel(
            self.model_size,
            device=device,
            compute_type=compute_type
        )
        logger.info("Whisper model loaded successfully")

    def _split_video(self, video_path: str, duration_minutes: float = 5) -> List[str]:
        """Разбиение длинного видео на части для экономии RAM."""
        import subprocess

        # Получаем длительность видео
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", video_path],
            capture_output=True, text=True
        )
        info = json.loads(result.stdout)
        total_duration = float(info["format"]["duration"])
        total_minutes = total_duration / 60

        if total_minutes <= duration_minutes:
            return [video_path]

        logger.info(
            "Video is %.1f min, splitting into %.0f min chunks",
            total_minutes, duration_minutes
        )

        temp_dir = tempfile.mkdtemp(prefix="v2s_split_")
        parts = []
        start = 0
        chunk_duration = duration_minutes * 60

        while start < total_duration:
            end = min(start + chunk_duration, total_duration)
            part_path = os.path.join(temp_dir, f"part_{len(parts):03d}.mp4")

            subprocess.run([
                "ffmpeg", "-y", "-i", video_path,
                "-ss", str(start), "-to", str(end),
                "-c", "copy", "-avoid_negative_ts", "make_zero",
                part_path
            ], capture_output=True)

            parts.append(part_path)
            start = end

        logger.info("Split into %d parts", len(parts))
        return parts

    def transcribe(self, video_path: str, progress_callback: Optional[Callable] = None) -> Dict:
        """
        Транскрибация видеофайла.

        Returns:
            Dict с ключами:
            - segments: список сегментов с текстом и таймкодами
            - words: пословная транскрибация
            - srt_path: путь к .srt файлу
            - json_path: путь к .json файлу
            - duration: длительность видео в секундах
        """
        logger.info("Starting transcription: %s", video_path)

        # Разбиение на части если видео длинное
        parts = self._split_video(video_path, self.split_duration)

        all_segments = []
        all_words = []
        time_offset = 0.0

        for i, part_path in enumerate(parts):
            logger.info("Transcribing part %d/%d", i + 1, len(parts))

            segments, info = self.model.transcribe(
                part_path,
                language=self.language,
                beam_size=5,
                word_timestamps=True,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=200
                )
            )

            for segment in segments:
                seg_dict = {
                    "id": len(all_segments),
                    "start": segment.start + time_offset,
                    "end": segment.end + time_offset,
                    "text": segment.text.strip()
                }
                all_segments.append(seg_dict)

                # Пословные таймкоды
                if segment.words:
                    for word in segment.words:
                        all_words.append({
                            "word": word.word.strip(),
                            "start": word.start + time_offset,
                            "end": word.end + time_offset,
                            "probability": word.probability
                        })

                if progress_callback:
                    progress_callback()

            # Получаем длительность части для смещения
            if len(parts) > 1:
                import subprocess
                result = subprocess.run(
                    ["ffprobe", "-v", "quiet", "-print_format", "json",
                     "-show_format", part_path],
                    capture_output=True, text=True
                )
                part_info = json.loads(result.stdout)
                time_offset += float(part_info["format"]["duration"])

        # Генерация SRT
        srt_content = self._generate_srt(all_segments)
        srt_path = self._save_srt(video_path, srt_content)

        # Генерация JSON
        json_data = {
            "segments": all_segments,
            "words": all_words,
            "language": self.language,
            "model": self.model_size
        }
        json_path = self._save_json(video_path, json_data)

        # Получаем общую длительность
        duration = all_segments[-1]["end"] if all_segments else 0

        result = {
            "segments": all_segments,
            "words": all_words,
            "srt_path": srt_path,
            "json_path": json_path,
            "duration": duration,
            "language": self.language
        }

        logger.info("Transcription complete: %d segments, %.1fs duration",
                     len(all_segments), duration)
        return result

    def _generate_srt(self, segments: List[Dict]) -> str:
        """Генерация SRT файла из сегментов."""
        srt_lines = []

        for i, seg in enumerate(segments, 1):
            start = self._format_srt_time(seg["start"])
            end = self._format_srt_time(seg["end"])
            text = seg["text"]

            srt_lines.append(f"{i}")
            srt_lines.append(f"{start} --> {end}")
            srt_lines.append(f"{text}")
            srt_lines.append("")

        return "\\n".join(srt_lines)

    def _format_srt_time(self, seconds: float) -> str:
        """Форматирование времени для SRT (HH:MM:SS,mmm)."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def _save_srt(self, video_path: str, content: str) -> str:
        """Сохранение SRT файла."""
        cache_dir = self.cache_dir / "transcriptions"
        cache_dir.mkdir(parents=True, exist_ok=True)
        srt_path = cache_dir / f"{Path(video_path).stem}.srt"
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write(content)
        logger.info("SRT saved: %s", srt_path)
        return str(srt_path)

    def _save_json(self, video_path: str, data: dict) -> str:
        """Сохранение JSON файла с транскрибацией."""
        cache_dir = self.cache_dir / "transcriptions"
        cache_dir.mkdir(parents=True, exist_ok=True)
        json_path = cache_dir / f"{Path(video_path).stem}_transcript.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("JSON saved: %s", json_path)
        return str(json_path)
`;

export const highlightFinderPy = `"""
Highlight Finder Module
Анализ транскрипта через локальную LLM для поиска вирусных фрагментов.
Поддержка Ollama (qwen2.5, llama3) и OpenAI API.
"""

import json
import logging
import re
from typing import Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


class HighlightFinder:
    """Поиск вирусных фрагментов в транскрипте через LLM."""

    HIGHLIGHT_PROMPT = """Ты — эксперт по созданию вирусного контента для TikTok и Instagram Reels.

Проанализируй транскрипт видео и найди {max_highlights} лучших фрагментов для коротких вертикальных роликов.

КРИТЕРИИ ВЫБОРА:
1. ХУК — фрагмент должен начинаться с цепляющей фразы, вопроса или провокации
2. ЭМОЦИЯ — ищи моменты с сильными эмоциями (удивление, смех, шок, вдохновение)
3. ЗАВЕРШЁННОСТЬ — фрагмент должен иметь логическое начало и конец
4. ДЛИТЕЛЬНОСТЬ — каждый фрагмент от {min_duration} до {max_duration} секунд
5. САМОСТОЯТЕЛЬНОСТЬ — фрагмент должен быть понятен без контекста всего видео

ТРАНСКРИПТ ВИДЕО (с таймкодами):
{transcript}

ДЛИТЕЛЬНОСТЬ ВИДЕО: {duration} секунд

ВЕРНИ РЕЗУЛЬТАТ СТРОГО В ФОРМАТЕ JSON (без markdown):
[
    {{
        "start": 120.5,
        "end": 165.0,
        "reason": "Краткое описание почему этот фрагмент вирусный",
        "hook": "Цепляющая фраза в начале фрагмента"
    }}
]

ВАЖНО:
- start и end — точные таймкоды из транскрипта
- Не накладывай фрагменты друг на друга
- Приоритет — эмоциональным и провокационным моментам
- Если фрагмент слишком короткий, расширь его в рамках {min_duration}-{max_duration} секунд
"""

    def __init__(self, config: dict):
        self.provider = config.get("llm_provider", "ollama")
        self.model = config.get("llm_model", "qwen2.5")
        self.base_url = config.get("llm_base_url", "http://localhost:11434")
        self.api_key = config.get("llm_api_key", "")
        self.max_highlights = config.get("max_highlights", 5)
        self.min_duration = config.get("highlight_min_duration", 30)
        self.max_duration = config.get("highlight_max_duration", 60)
        self.temperature = config.get("llm_temperature", 0.3)

    def find_highlights(self, transcription: Dict, video_path: str = "") -> Dict:
        """
        Поиск хайлайтов в транскрипте.

        Args:
            transcription: Результат транскрибации с segments и words
            video_path: Путь к видео (для логирования)

        Returns:
            Dict с ключом "highlights" — список найденных фрагментов
        """
        segments = transcription.get("segments", [])
        duration = transcription.get("duration", 0)

        if not segments:
            logger.warning("No segments found in transcription")
            return {"highlights": []}

        # Форматирование транскрипта для промпта
        transcript_text = self._format_transcript(segments)

        # Формирование промпта
        prompt = self.HIGHLIGHT_PROMPT.format(
            transcript=transcript_text,
            duration=duration,
            max_highlights=self.max_highlights,
            min_duration=self.min_duration,
            max_duration=self.max_duration
        )

        logger.info("Sending transcript to LLM (%d chars)", len(prompt))

        # Запрос к LLM
        if self.provider == "ollama":
            response = self._query_ollama(prompt)
        elif self.provider == "openai":
            response = self._query_openai(prompt)
        else:
            raise ValueError(f"Unknown LLM provider: {self.provider}")

        # Парсинг ответа
        highlights = self._parse_response(response)

        # Валидация и постобработка
        highlights = self._validate_highlights(highlights, duration)

        logger.info("Found %d valid highlights", len(highlights))
        return {"highlights": highlights}

    def _format_transcript(self, segments: List[Dict]) -> str:
        """Форматирование транскрипта с таймкодами."""
        lines = []
        for seg in segments:
            start = seg["start"]
            text = seg["text"]
            lines.append(f"[{start:.1f}s] {text}")
        return "\\n".join(lines)

    def _query_ollama(self, prompt: str) -> str:
        """Запрос к Ollama API."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "num_predict": 2048
            }
        }

        try:
            logger.info("Querying Ollama: %s model=%s", url, self.model)
            response = requests.post(url, json=payload, timeout=300)
            response.raise_for_status()
            result = response.json()
            return result.get("response", "")
        except requests.exceptions.ConnectionError:
            logger.error("Cannot connect to Ollama at %s", self.base_url)
            raise RuntimeError(
                f"Cannot connect to Ollama at {self.base_url}. "
                "Make sure Ollama is running: ollama serve"
            )
        except Exception as e:
            logger.error("Ollama request failed: %s", str(e))
            raise

    def _query_openai(self, prompt: str) -> str:
        """Запрос к OpenAI-совместимому API."""
        url = f"{self.base_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "Ты — эксперт по вирусному контенту."},
                {"role": "user", "content": prompt}
            ],
            "temperature": self.temperature,
            "max_tokens": 2048
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=120)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error("OpenAI API request failed: %s", str(e))
            raise

    def _parse_response(self, response: str) -> List[Dict]:
        """Парсинг JSON-ответа от LLM."""
        # Попытка извлечь JSON из ответа
        json_match = re.search(r'\\[.*\\]', response, re.DOTALL)
        if json_match:
            json_str = json_match.group()
        else:
            # Попробуем очистить от markdown
            cleaned = re.sub(r'\`\`\`json\\n?', '', response)
            cleaned = re.sub(r'\`\`\`\\n?', '', cleaned)
            json_str = cleaned.strip()

        try:
            highlights = json.loads(json_str)
            if isinstance(highlights, list):
                return highlights
            elif isinstance(highlights, dict) and "highlights" in highlights:
                return highlights["highlights"]
        except json.JSONDecodeError as e:
            logger.error("Failed to parse LLM response as JSON: %s", str(e))
            logger.debug("Raw response: %s", response[:500])

        return []

    def _validate_highlights(self, highlights: List[Dict], total_duration: float) -> List[Dict]:
        """Валидация и постобработка хайлайтов."""
        valid = []

        for h in highlights:
            # Проверка обязательных полей
            if "start" not in h or "end" not in h:
                logger.warning("Skipping highlight without start/end: %s", h)
                continue

            start = float(h["start"])
            end = float(h["end"])

            # Проверка границ
            if start < 0 or end > total_duration:
                logger.warning("Highlight out of bounds: %.1f-%.1f (total: %.1f)",
                             start, end, total_duration)
                start = max(0, start)
                end = min(total_duration, end)

            # Проверка длительности
            duration = end - start
            if duration < 5:
                logger.warning("Highlight too short (%.1fs), skipping", duration)
                continue

            # Проверка наложения
            overlap = False
            for v in valid:
                if not (end <= v["start"] or start >= v["end"]):
                    overlap = True
                    logger.warning("Highlight overlaps with existing, adjusting")
                    start = v["end"] + 1
                    break

            if overlap and start >= end:
                continue

            valid.append({
                "start": start,
                "end": end,
                "reason": h.get("reason", ""),
                "hook": h.get("hook", "")
            })

        # Сортировка по времени
        valid.sort(key=lambda x: x["start"])
        return valid[:self.max_highlights]
`;

export const faceTrackerPy = `"""
Face Tracker Module
Трекинг лица/спикера через YOLOv8 с возвратом координат для каждого кадра.
Включает сглаживание через фильтр Калмана.
"""

import logging
import numpy as np
from typing import Dict, List, Optional, Tuple

import cv2
from ultralytics import YOLO

logger = logging.getLogger(__name__)


class KalmanFilter:
    """Простой фильтр Калмана для сглаживания координат."""

    def __init__(self, process_noise: float = 1.0, measurement_noise: float = 4.0):
        # Состояние: [x, y, vx, vy]
        self.state = np.array([0.0, 0.0, 0.0, 0.0])
        self.dt = 1.0  # временной шаг (1 кадр)

        # Матрица перехода состояния
        self.F = np.array([
            [1, 0, self.dt, 0],
            [0, 1, 0, self.dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ])

        # Матрица наблюдения
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])

        # Ковариационные матрицы
        self.Q = np.eye(4) * process_noise  # шум процесса
        self.R = np.eye(2) * measurement_noise  # шум измерения

        # Ковариация состояния
        self.P = np.eye(4) * 500

        self.initialized = False

    def predict(self) -> np.ndarray:
        """Предсказание следующего состояния."""
        self.state = self.F @ self.state
        self.P = self.F @ self.P @ self.F.T + self.Q
        return self.state[:2]

    def update(self, measurement: np.ndarray) -> np.ndarray:
        """Обновление состояния на основе измерения."""
        if not self.initialized:
            self.state[:2] = measurement
            self.initialized = True
            return measurement

        # Innovation
        y = measurement - self.H @ self.state
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)

        # Update
        self.state = self.state + K @ y
        I = np.eye(4)
        self.P = (I - K @ self.H) @ self.P

        return self.state[:2]

    def process(self, x: float, y: float) -> Tuple[float, float]:
        """Полный цикл predict + update."""
        self.predict()
        measurement = np.array([x, y])
        result = self.update(measurement)
        return float(result[0]), float(result[1])


class MovingAverageFilter:
    """Фильтр скользящего среднего для сглаживания."""

    def __init__(self, window_size: int = 15):
        self.window_size = window_size
        self.x_buffer = []
        self.y_buffer = []

    def process(self, x: float, y: float) -> Tuple[float, float]:
        self.x_buffer.append(x)
        self.y_buffer.append(y)

        if len(self.x_buffer) > self.window_size:
            self.x_buffer.pop(0)
            self.y_buffer.pop(0)

        smooth_x = sum(self.x_buffer) / len(self.x_buffer)
        smooth_y = sum(self.y_buffer) / len(self.y_buffer)
        return smooth_x, smooth_y


class FaceTracker:
    """Трекинг лица/спикера через YOLOv8."""

    def __init__(self, config: dict):
        self.model_path = config.get("yolo_model", "yolov8n.pt")
        self.confidence = config.get("yolo_confidence", 0.5)
        self.smoothing_window = config.get("smoothing_window", 15)
        self.output_width = config.get("output_resolution", [1080, 1920])[0]
        self.output_height = config.get("output_resolution", [1080, 1920])[1]

        self.model = None
        self._load_model()

    def _load_model(self):
        """Загрузка модели YOLOv8."""
        logger.info("Loading YOLOv8 model: %s", self.model_path)
        self.model = YOLO(self.model_path)
        logger.info("YOLOv8 model loaded successfully")

    def track(self, video_path: str, highlights: List[Dict] = None) -> Dict:
        """
        Трекинг лица в видео.

        Args:
            video_path: Путь к видеофайлу
            highlights: Список хайлайтов для обработки (если None — всё видео)

        Returns:
            Dict с ключом "frames" — список координат для каждого кадра
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        logger.info(
            "Video: %dx%d @ %.1f fps, %d frames",
            width, height, fps, total_frames
        )

        # Определяем диапазоны кадров для обработки
        if highlights:
            frame_ranges = []
            for h in highlights:
                start_frame = int(h["start"] * fps)
                end_frame = int(h["end"] * fps)
                frame_ranges.append((start_frame, end_frame))
        else:
            frame_ranges = [(0, total_frames)]

        # Инициализация фильтров
        kalman = KalmanFilter()
        ma_filter = MovingAverageFilter(self.smoothing_window)

        frames_data = []
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Проверяем, нужно ли обрабатывать этот кадр
            in_range = any(start <= frame_idx <= end for start, end in frame_ranges)

            if in_range:
                # Детекция людей
                results = self.model(frame, conf=self.confidence, verbose=False)

                person_center = self._get_speaker_position(results, width, height)

                if person_center:
                    raw_x, raw_y = person_center

                    # Сглаживание через Калман + скользящее среднее
                    kalman_x, kalman_y = kalman.process(raw_x, raw_y)
                    smooth_x, smooth_y = ma_filter.process(kalman_x, kalman_y)

                    # Ограничение координат
                    crop_width = int(height * 9 / 16)  # Ширина кропа 9:16
                    half_crop = crop_width // 2
                    smooth_x = np.clip(smooth_x, half_crop, width - half_crop)
                    smooth_y = np.clip(smooth_y, height // 4, height * 3 // 4)

                    frames_data.append({
                        "frame": frame_idx,
                        "time": frame_idx / fps,
                        "x": float(smooth_x),
                        "y": float(smooth_y),
                        "raw_x": float(raw_x),
                        "raw_y": float(raw_y)
                    })
                else:
                    # Если лицо не обнаружено — центр кадра
                    center_x = width / 2
                    center_y = height / 2
                    smooth_x, smooth_y = ma_filter.process(center_x, center_y)

                    frames_data.append({
                        "frame": frame_idx,
                        "time": frame_idx / fps,
                        "x": float(smooth_x),
                        "y": float(smooth_y),
                        "raw_x": float(center_x),
                        "raw_y": float(center_y)
                    })

            frame_idx += 1

        cap.release()

        logger.info("Tracking complete: %d frames processed", len(frames_data))

        return {
            "frames": frames_data,
            "video_width": width,
            "video_height": height,
            "fps": fps,
            "total_frames": total_frames
        }

    def _get_speaker_position(
        self, results, frame_width: int, frame_height: int
    ) -> Optional[Tuple[float, float]]:
        """
        Определение позиции спикера из результатов YOLO.
        Если несколько людей — выбирает самого крупного.
        """
        persons = []

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])

                # Класс 0 = person в COCO
                if cls == 0 and conf >= self.confidence:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    w = x2 - x1
                    h = y2 - y1
                    area = w * h
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2
                    persons.append({
                        "center": (center_x, center_y),
                        "area": area,
                        "confidence": conf
                    })

        if not persons:
            return None

        # Выбираем самого крупного человека
        largest = max(persons, key=lambda p: p["area"])
        return largest["center"]
`;

export const videoRendererPy = `"""
Video Renderer Module
Рендер через FFmpeg с динамическим кропом 9:16 и наложением субтитров.
"""

import os
import json
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class VideoRenderer:
    """Рендер вертикальных видео через FFmpeg."""

    def __init__(self, config: dict):
        self.output_width = config.get("output_resolution", [1080, 1920])[0]
        self.output_height = config.get("output_resolution", [1080, 1920])[1]
        self.output_fps = config.get("output_fps", 30)
        self.output_codec = config.get("output_codec", "libx264")
        self.subtitle_font_size = config.get("subtitle_font_size", 48)
        self.subtitle_font_color = config.get("subtitle_font_color", "white")
        self.subtitle_outline_color = config.get("subtitle_outline_color", "black")
        self.subtitle_outline_width = config.get("subtitle_outline_width", 3)
        self.cache_dir = Path(config.get("cache_dir", "cache"))

    def render(
        self,
        input_video: str,
        output_path: str,
        highlight: Dict,
        tracking_data: Dict,
        srt_path: str = ""
    ) -> str:
        """
        Рендер одного клипа.

        Args:
            input_video: Путь к исходному видео
            output_path: Путь для сохранения результата
            highlight: Dict с start/end таймкодами
            tracking_data: Данные трекинга с координатами
            srt_path: Путь к SRT файлу для субтитров

        Returns:
            Путь к отрендеренному файлу
        """
        start_time = highlight["start"]
        end_time = highlight["end"]
        duration = end_time - start_time

        logger.info(
            "Rendering clip: %.1fs - %.1fs (%.1fs)",
            start_time, end_time, duration
        )

        # Получаем сглаженные координаты для этого фрагмента
        crop_positions = self._get_crop_positions(
            tracking_data, start_time, end_time
        )

        # Генерируем фильтр для динамического кропа
        crop_filter = self._build_crop_filter(crop_positions, tracking_data)

        # Строим FFmpeg команду
        cmd = self._build_ffmpeg_command(
            input_video, output_path, start_time, duration,
            crop_filter, srt_path, start_time
        )

        # Выполняем рендер
        logger.info("Running FFmpeg...")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 минут таймаут
            )

            if result.returncode != 0:
                logger.error("FFmpeg error: %s", result.stderr[-500:])
                raise RuntimeError(f"FFmpeg failed with code {result.returncode}")

            logger.info("Clip rendered: %s", output_path)
            return output_path

        except subprocess.TimeoutExpired:
            logger.error("FFmpeg timed out for clip: %s", output_path)
            raise

    def _get_crop_positions(
        self, tracking_data: Dict, start_time: float, end_time: float
    ) -> List[Dict]:
        """Получение позиций кропа для заданного временного диапазона."""
        frames = tracking_data.get("frames", [])
        video_width = tracking_data.get("video_width", 1920)
        video_height = tracking_data.get("video_height", 1080)

        # Ширина кропа (9:16 от высоты)
        crop_width = int(video_height * 9 / 16)

        relevant_frames = [
            f for f in frames
            if start_time <= f["time"] <= end_time
        ]

        if not relevant_frames:
            # Если нет данных трекинга — центр кадра
            return [{
                "time": start_time,
                "x": video_width / 2,
                "y": video_height / 2
            }]

        positions = []
        for f in relevant_frames:
            # Вычисляем смещение кропа
            raw_x = f["x"]
            half_crop = crop_width / 2

            # Ограничиваем позицию кропа
            crop_x = max(half_crop, min(raw_x, video_width - half_crop))

            positions.append({
                "time": f["time"],
                "x": crop_x,
                "y": f["y"]
            })

        return positions

    def _build_crop_filter(
        self, positions: List[Dict], tracking_data: Dict
    ) -> str:
        """
        Построение FFmpeg фильтра для динамического кропа.
        Использует sendcmd для изменения позиции кропа по времени.
        """
        video_width = tracking_data.get("video_width", 1920)
        video_height = tracking_data.get("video_height", 1080)
        crop_width = int(video_height * 9 / 16)
        crop_height = video_height

        if len(positions) <= 1:
            # Статичный кроп
            x = positions[0]["x"] - crop_width / 2 if positions else video_width / 2 - crop_width / 2
            y = 0  # Всегда сверху для вертикального видео
            return f"crop={crop_width}:{crop_height}:{x}:{y}"

        # Динамический кроп через sendcmd
        # Генерируем файл команд
        commands = []
        for i, pos in enumerate(positions):
            x = pos["x"] - crop_width / 2
            x = max(0, min(x, video_width - crop_width))
            commands.append(f"{pos['time']} crop x {x}")

        # Создаём временный файл с командами
        cmd_file = self.cache_dir / "crop_commands.txt"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        with open(cmd_file, 'w') as f:
            f.write("\\n".join(commands))

        # Используем zoompan для плавного движения
        # Или sendcmd для точного позиционирования
        return (
            f"sendcmd=f='{cmd_file}',"
            f"crop={crop_width}:{crop_height}:x:n*0"
        )

    def _build_ffmpeg_command(
        self,
        input_video: str,
        output_path: str,
        start_time: float,
        duration: float,
        crop_filter: str,
        srt_path: str,
        segment_start: float
    ) -> List[str]:
        """Построение полной FFmpeg команды."""
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", input_video,
        ]

        # Видео фильтры
        vf_filters = [crop_filter]

        # Масштабирование до целевого разрешения
        vf_filters.append(
            f"scale={self.output_width}:{self.output_height}"
            f":force_original_aspect_ratio=disable"
        )

        # Субтитры (burn-in)
        if srt_path and os.path.exists(srt_path):
            # Экранируем путь для FFmpeg
            escaped_srt = srt_path.replace("\\\\", "/").replace(":", "\\\\:")
            subtitle_filter = (
                f"subtitles='{escaped_srt}'"
                f":force_style='FontSize={self.subtitle_font_size},"
                f"PrimaryColour=&H00FFFFFF,"
                f"OutlineColour=&H00000000,"
                f"Outline={self.subtitle_outline_width},"
                f"Alignment=2,"
                f"MarginV=80'"
            )
            vf_filters.append(subtitle_filter)

        vf_string = ",".join(vf_filters)

        cmd.extend([
            "-vf", vf_string,
            "-c:v", self.output_codec,
            "-preset", "medium",
            "-crf", "18",
            "-r", str(self.output_fps),
            "-c:a", "aac",
            "-b:a", "192k",
            "-ac", "2",
            "-movflags", "+faststart",
            "-pix_fmt", "yuv420p",
            output_path
        ])

        logger.debug("FFmpeg command: %s", " ".join(cmd))
        return cmd

    def render_test_clip(
        self,
        input_video: str,
        output_path: str,
        start_time: float,
        duration: float = 5.0
    ) -> str:
        """Рендер короткого тестового клипа для быстрой проверки."""
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", input_video,
            "-vf", f"scale={self.output_width}:{self.output_height}",
            "-c:v", self.output_codec,
            "-preset", "ultrafast",
            "-crf", "23",
            "-c:a", "aac",
            output_path
        ]

        subprocess.run(cmd, capture_output=True, timeout=60)
        return output_path
`;

export const configYaml = `# Video2Shorts Configuration
# ===========================

# Транскрибация (faster-whisper)
whisper_model: "medium"          # tiny, base, small, medium, large-v3
whisper_language: "ru"           # Код языка (ru, en, etc.)
whisper_device: "auto"           # auto, cuda, cpu

# LLM для поиска хайлайтов
llm_provider: "ollama"           # ollama или openai
llm_model: "qwen2.5"            # Модель LLM
llm_base_url: "http://localhost:11434"  # URL API
llm_api_key: ""                  # API ключ (для OpenAI)
llm_temperature: 0.3             # Температура генерации

# YOLOv8 трекинг
yolo_model: "yolov8n.pt"         # yolov8n, yolov8s, yolov8m, yolov8l
yolo_confidence: 0.5             # Порог уверенности детекции

# Сглаживание координат
smoothing_window: 15             # Размер окна скользящего среднего

# Параметры выходного видео
output_resolution: [1080, 1920]  # Ширина x Высота (9:16)
output_fps: 30                   # Кадров в секунду
output_codec: "libx264"          # Видеокодек

# Поиск хайлайтов
highlight_min_duration: 30       # Мин. длительность фрагмента (сек)
highlight_max_duration: 60       # Макс. длительность фрагмента (сек)
max_highlights: 5                # Макс. количество хайлайтов

# Субтитры
subtitle_font_size: 48           # Размер шрифта
subtitle_font_color: "white"     # Цвет текста
subtitle_outline_color: "black"  # Цвет обводки
subtitle_outline_width: 3        # Толщина обводки

# Кэширование
cache_dir: "cache"               # Директория для кэша

# Разбиение длинных видео
split_threshold_minutes: 10      # Порог для разбиения (минуты)
split_duration_minutes: 5        # Длительность частей (минуты)
`;

export const installSh = `#!/bin/bash
# Video2Shorts Installation Script (Linux/Mac)
# =============================================

set -e

echo "🎬 Video2Shorts Installer"
echo "========================="

# Проверка Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3.10+ is required. Install it first."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✅ Python version: $PYTHON_VERSION"

# Проверка FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install ffmpeg
    else
        sudo apt-get update && sudo apt-get install -y ffmpeg
    fi
fi
echo "✅ FFmpeg: $(ffmpeg -version 2>&1 | head -n1)"

# Создание виртуального окружения
echo "📦 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Установка зависимостей
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Проверка CUDA
echo "🔍 Checking GPU support..."
python3 -c "
import torch
if torch.cuda.is_available():
    print(f'✅ CUDA available: {torch.cuda.get_device_name(0)}')
else:
    print('⚠️  CUDA not available - will use CPU (slower)')
" 2>/dev/null || echo "⚠️  PyTorch not installed yet, skipping GPU check"

# Скачивание моделей
echo "📥 Downloading models..."
python3 -c "
from ultralytics import YOLO
model = YOLO('yolov8n.pt')
print('✅ YOLOv8 model downloaded')
"

python3 -c "
from faster_whisper import WhisperModel
model = WhisperModel('medium', device='cpu', compute_type='int8')
print('✅ Whisper model downloaded')
"

# Проверка Ollama
echo "🔍 Checking Ollama..."
if command -v ollama &> /dev/null; then
    echo "✅ Ollama found"
    ollama list 2>/dev/null | grep -q "qwen2.5" || {
        echo "📥 Pulling qwen2.5 model..."
        ollama pull qwen2.5
    }
else
    echo "⚠️  Ollama not found. Install from: https://ollama.ai"
    echo "   Then run: ollama pull qwen2.5"
fi

# Создание директорий
mkdir -p output/test_clips cache

echo ""
echo "✅ Installation complete!"
echo ""
echo "Usage:"
echo "  source venv/bin/activate"
echo "  python main.py --input ./videos/ --output ./clips/"
echo "  python main.py --input video.mp4 --output ./clips/ --dry-run"
`;

export const installBat = `@echo off
REM Video2Shorts Installation Script (Windows)
REM ===========================================

echo Video2Shorts Installer
echo =========================

REM Проверка Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3.10+ is required. Install it first.
    exit /b 1
)
echo [OK] Python found

REM Проверка FFmpeg
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo WARNING: FFmpeg not found. Please install FFmpeg and add to PATH.
    echo Download: https://ffmpeg.org/download.html
) else (
    echo [OK] FFmpeg found
)

REM Создание виртуального окружения
echo Creating virtual environment...
python -m venv venv
call venv\\Scripts\\activate.bat

REM Установка зависимостей
echo Installing Python dependencies...
pip install --upgrade pip
pip install -r requirements.txt

REM Проверка CUDA
echo Checking GPU support...
python -c "import torch; print(f'CUDA: {torch.cuda.get_device_name(0)}' if torch.cuda.is_available() else 'CPU mode')" 2>nul

REM Скачивание моделей
echo Downloading models...
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt'); print('YOLOv8 OK')"
python -c "from faster_whisper import WhisperModel; WhisperModel('medium', device='cpu', compute_type='int8'); print('Whisper OK')"

REM Создание директорий
if not exist output\\test_clips mkdir output\\test_clips
if not exist cache mkdir cache

echo.
echo Installation complete!
echo.
echo Usage:
echo   venv\\Scripts\\activate
echo   python main.py --input .\\videos\\ --output .\\clips\\
`;

export const requirementsTxt = `# Video2Shorts Dependencies
# =========================

# Core
faster-whisper>=1.0.0
ultralytics>=8.1.0
opencv-python>=4.8.0
numpy>=1.24.0

# LLM
requests>=2.31.0

# Video processing
ffmpeg-python>=0.2.0

# Config
pyyaml>=6.0

# Progress
tqdm>=4.66.0

# GPU support (optional, install separately if needed)
# torch>=2.0.0
# torchvision>=0.15.0
`;

export const testTranscriberPy = `"""
Test script for Transcriber module.
Usage: python test_transcriber.py --input video.mp4
"""

import argparse
import logging
import json
import sys

from transcriber import Transcriber

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Test Transcriber module")
    parser.add_argument("--input", "-i", required=True, help="Input video file")
    parser.add_argument("--model", "-m", default="medium", help="Whisper model size")
    parser.add_argument("--language", "-l", default="ru", help="Language code")
    args = parser.parse_args()

    config = {
        "whisper_model": args.model,
        "whisper_language": args.language,
        "whisper_device": "auto",
        "cache_dir": "cache",
        "split_threshold_minutes": 10,
        "split_duration_minutes": 5,
    }

    transcriber = Transcriber(config)
    result = transcriber.transcribe(args.input)

    print("\\n" + "=" * 50)
    print("TRANSCRIPTION RESULTS")
    print("=" * 50)
    print(f"Segments: {len(result['segments'])}")
    print(f"Words: {len(result['words'])}")
    print(f"Duration: {result['duration']:.1f}s")
    print(f"SRT: {result['srt_path']}")
    print(f"JSON: {result['json_path']}")
    print("\\nFirst 5 segments:")
    for seg in result['segments'][:5]:
        print(f"  [{seg['start']:.1f}s - {seg['end']:.1f}s] {seg['text']}")


if __name__ == "__main__":
    main()
`;

export const testTrackerPy = `"""
Test script for Face Tracker module.
Usage: python test_tracker.py --input video.mp4
"""

import argparse
import logging
import json

from face_tracker import FaceTracker

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Test Face Tracker module")
    parser.add_argument("--input", "-i", required=True, help="Input video file")
    parser.add_argument("--model", "-m", default="yolov8n.pt", help="YOLO model")
    parser.add_argument("--frames", "-f", type=int, default=100, help="Max frames to process")
    args = parser.parse_args()

    config = {
        "yolo_model": args.model,
        "yolo_confidence": 0.5,
        "smoothing_window": 15,
        "output_resolution": [1080, 1920],
        "cache_dir": "cache",
    }

    tracker = FaceTracker(config)
    result = tracker.track(args.input)

    print("\\n" + "=" * 50)
    print("TRACKING RESULTS")
    print("=" * 50)
    print(f"Video: {result['video_width']}x{result['video_height']} @ {result['fps']:.1f}fps")
    print(f"Total frames: {result['total_frames']}")
    print(f"Tracked frames: {len(result['frames'])}")

    if result['frames']:
        xs = [f['x'] for f in result['frames']]
        ys = [f['y'] for f in result['frames']]
        print(f"\\nX range: {min(xs):.1f} - {max(xs):.1f}")
        print(f"Y range: {min(ys):.1f} - {max(ys):.1f}")

        print("\\nFirst 10 frames:")
        for f in result['frames'][:10]:
            print(f"  Frame {f['frame']} ({f['time']:.2f}s): "
                  f"({f['x']:.1f}, {f['y']:.1f}) "
                  f"raw: ({f['raw_x']:.1f}, {f['raw_y']:.1f})")


if __name__ == "__main__":
    main()
`;

export const readmeMd = `# 🎬 Video2Shorts

Автоматическая конвертация длинных горизонтальных видео в короткие вертикальные ролики (9:16) для TikTok, Instagram Reels и VK Клипов.

## 🚀 Возможности

- 🎙️ **Транскрибация** — faster-whisper с поддержкой русского языка
- 🧠 **AI-хайлайты** — поиск вирусных фрагментов через LLM (Ollama/OpenAI)
- 👤 **Трекинг лица** — YOLOv8 с фильтром Калмана для плавного кропа
- 🎞️ **Рендер** — FFmpeg с динамическим кропом и burn-in субтитрами
- 📦 **Пакетная обработка** — рекурсивная обработка папок с видео
- 💾 **Кэширование** — возможность возобновления после прерывания
- 🔧 **Dry-run режим** — проверка без рендеринга

## 📋 Системные требования

- Python 3.10+
- FFmpeg (в PATH)
- NVIDIA GPU (опционально, для ускорения)
- Ollama (для локальной LLM)
- 8GB+ RAM (16GB+ рекомендуется)

## ⚡ Быстрый старт

### Linux/Mac

\`\`\`bash
chmod +x install.sh
./install.sh
\`\`\`

### Windows

\`\`\`cmd
install.bat
\`\`\`

### Ручная установка

\`\`\`bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или: venv\\Scripts\\activate  # Windows

pip install -r requirements.txt

# Скачать модели
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
python -c "from faster_whisper import WhisperModel; WhisperModel('medium')"

# Установить Ollama и модель
ollama pull qwen2.5
\`\`\`

## 🎯 Использование

### Базовый запуск

\`\`\`bash
python main.py --input ./videos/ --output ./clips/
\`\`\`

### Одно видео

\`\`\`bash
python main.py --input my_video.mp4 --output ./clips/
\`\`\`

### Dry-run (без рендера)

\`\`\`bash
python main.py --input ./videos/ --output ./clips/ --dry-run
\`\`\`

### С кастомным конфигом

\`\`\`bash
python main.py --input ./videos/ --output ./clips/ --config my_config.yaml
\`\`\`

### Подробное логирование

\`\`\`bash
python main.py --input ./videos/ --output ./clips/ --verbose
\`\`\`

## 📁 Структура проекта

\`\`\`
video2shorts/
├── main.py              # Оркестратор пайплайна
├── transcriber.py       # Транскрибация (faster-whisper)
├── highlight_finder.py  # Поиск хайлайтов (LLM)
├── face_tracker.py      # Трекинг лица (YOLOv8)
├── video_renderer.py    # Рендер (FFmpeg)
├── config.yaml          # Конфигурация
├── requirements.txt     # Зависимости
├── install.sh           # Установка (Linux/Mac)
├── install.bat          # Установка (Windows)
├── test_transcriber.py  # Тест транскрибации
├── test_tracker.py      # Тест трекинга
├── cache/               # Кэш промежуточных результатов
└── output/              # Выходные видео
    └── test_clips/      # Тестовые 5-секундные клипы
\`\`\`

## 🔧 Конфигурация

Все параметры настраиваются через \`config.yaml\`. Основные параметры:

| Параметр | По умолчанию | Описание |
|----------|-------------|----------|
| whisper_model | medium | Модель Whisper (tiny/base/small/medium/large-v3) |
| llm_model | qwen2.5 | Модель LLM для поиска хайлайтов |
| yolo_model | yolov8n.pt | Модель YOLO для трекинга |
| max_highlights | 5 | Макс. количество клипов |
| highlight_min_duration | 30 | Мин. длительность клипа (сек) |
| highlight_max_duration | 60 | Макс. длительность клипа (сек) |
| smoothing_window | 15 | Окно сглаживания координат |

## ❓ Troubleshooting

### FFmpeg не найден
\`\`\`bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows: скачать с https://ffmpeg.org/download.html и добавить в PATH
\`\`\`

### Ollama не отвечает
\`\`\`bash
# Запустить Ollama
ollama serve

# Проверить доступность
curl http://localhost:11434/api/tags
\`\`\`

### Out of Memory при транскрибации
- Используйте модель \`small\` вместо \`medium\`
- Уменьшите \`split_duration_minutes\` в конфиге
- Закройте другие программы

### CUDA не обнаружена
- Убедитесь что установлены NVIDIA драйверы
- Переустановите PyTorch: \`pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121\`
- Или используйте CPU: \`whisper_device: cpu\` в конфиге

### Субтитры не отображаются
- Проверьте путь к .srt файлу
- Убедитесь что шрифт поддерживается FFmpeg
- Попробуйте упростить путь (без кириллицы и пробелов)

## 📄 Лицензия

MIT License
`;
