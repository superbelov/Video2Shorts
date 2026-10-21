#!/usr/bin/env python3
"""
Модуль транскрибации аудио из видео.
Использует faster-whisper для распознавания речи с поддержкой русского языка.
Генерирует .srt (субтитры) и .json (с пословными таймкодами).
"""

import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

from tqdm import tqdm

logger = logging.getLogger(__name__)


class Transcriber:
    """Транскрибация аудио через faster-whisper."""

    def __init__(
        self,
        model_size: str = 'medium',
        language: str = 'ru',
        device: str = 'auto',
        compute_type: str = 'float16'
    ):
        self.model_size = model_size
        self.language = language
        self.device = device
        self.compute_type = compute_type
        self.model = None

    def _load_model(self):
        """Ленивая загрузка модели faster-whisper."""
        if self.model is not None:
            return

        logger.info(f"Загрузка модели Whisper '{self.model_size}'...")

        try:
            from faster_whisper import WhisperModel
        except ImportError:
            raise ImportError(
                "faster-whisper не установлен. Установите: pip install faster-whisper"
            )

        # Автоопределение устройства
        if self.device == 'auto':
            try:
                import torch
                self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
            except ImportError:
                self.device = 'cpu'

        if self.device == 'cpu':
            self.compute_type = 'int8'

        logger.info(f"Устройство: {self.device}, тип вычислений: {self.compute_type}")

        self.model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type
        )
        logger.info("Модель загружена успешно")

    def _extract_audio(self, video_path: str, output_path: str) -> str:
        """Извлечение аудио из видео через FFmpeg."""
        logger.info(f"Извлечение аудио из {video_path}...")

        cmd = [
            'ffmpeg', '-i', video_path,
            '-vn',                    # без видео
            '-acodec', 'pcm_s16le',  # WAV формат для лучшего качества
            '-ar', '16000',          # 16kHz для Whisper
            '-ac', '1',              # моно
            '-y',                    # перезапись
            output_path
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            logger.info(f"Аудио извлечено: {output_path}")
            return output_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Ошибка извлечения аудио: {e.stderr}")
            raise

    def _get_video_duration(self, video_path: str) -> float:
        """Получение длительности видео в секундах."""
        cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())

    def _split_video(self, video_path: str, output_dir: str, chunk_seconds: int) -> List[str]:
        """Разбиение видео на части для экономии RAM."""
        duration = self._get_video_duration(video_path)

        if duration <= chunk_seconds:
            return [video_path]

        num_chunks = int(duration // chunk_seconds) + 1
        logger.info(f"Видео разбивается на {num_chunks} частей по {chunk_seconds // 60} минут")

        chunks = []
        for i in range(num_chunks):
            start_time = i * chunk_seconds
            chunk_path = os.path.join(output_dir, f"chunk_{i:03d}.wav")

            cmd = [
                'ffmpeg', '-i', video_path,
                '-vn',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                '-ss', str(start_time),
                '-t', str(chunk_seconds),
                '-y',
                chunk_path
            ]

            subprocess.run(cmd, check=True, capture_output=True, text=True)
            chunks.append(chunk_path)

        return chunks

    def transcribe(
        self,
        video_path: str,
        output_dir: str = '.',
        max_chunk_seconds: int = 300
    ) -> Dict:
        """
        Транскрибация видеофайла.

        Args:
            video_path: Путь к видеофайлу
            output_dir: Директория для выходных файлов
            max_chunk_seconds: Максимальная длина чанка в секундах

        Returns:
            Dict с транскриптом:
            {
                'text': 'полный текст',
                'segments': [{'start': 0.0, 'end': 5.0, 'text': '...'}],
                'words': [{'word': 'привет', 'start': 0.0, 'end': 0.5, 'probability': 0.95}]
            }
        """
        self._load_model()
        os.makedirs(output_dir, exist_ok=True)

        video_name = Path(video_path).stem
        duration = self._get_video_duration(video_path)

        logger.info(f"Длительность видео: {duration:.1f}с ({duration/60:.1f} мин)")

        # Разбиение на части если видео длинное
        with tempfile.TemporaryDirectory() as temp_dir:
            chunks = self._split_video(video_path, temp_dir, max_chunk_seconds)

            all_segments = []
            all_words = []
            time_offset = 0.0

            for chunk_idx, chunk_path in enumerate(chunks):
                logger.info(f"Транскрибация части {chunk_idx + 1}/{len(chunks)}...")

                segments, info = self.model.transcribe(
                    chunk_path,
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
                    # Корректировка таймкодов с учётом смещения
                    adjusted_segment = {
                        'start': segment.start + time_offset,
                        'end': segment.end + time_offset,
                        'text': segment.text.strip()
                    }
                    all_segments.append(adjusted_segment)

                    # Пословные таймкоды
                    if segment.words:
                        for word in segment.words:
                            all_words.append({
                                'word': word.word.strip(),
                                'start': word.start + time_offset,
                                'end': word.end + time_offset,
                                'probability': round(word.probability, 3)
                            })

                # Обновляем смещение для следующего чанка
                chunk_duration = self._get_audio_duration(chunk_path)
                time_offset += chunk_duration

        # Формирование результата
        full_text = ' '.join([s['text'] for s in all_segments])

        result = {
            'text': full_text,
            'segments': all_segments,
            'words': all_words,
            'language': self.language,
            'duration': duration,
            'model': self.model_size
        }

        # Сохранение JSON с таймкодами
        json_path = os.path.join(output_dir, f"{video_name}_transcript.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        logger.info(f"Транскрипт сохранён: {json_path}")

        # Генерация SRT файла
        srt_path = os.path.join(output_dir, f"{video_name}.srt")
        self._generate_srt(all_segments, srt_path)
        logger.info(f"Субтитры сохранены: {srt_path}")

        return result

    def _get_audio_duration(self, audio_path: str) -> float:
        """Получение длительности аудиофайла."""
        cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            audio_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())

    def _generate_srt(self, segments: List[Dict], output_path: str):
        """Генерация SRT файла из сегментов."""

        def format_srt_time(seconds: float) -> str:
            """Конвертация секунд в формат SRT времени (HH:MM:SS,mmm)."""
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int((seconds % 1) * 1000)
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

        with open(output_path, 'w', encoding='utf-8') as f:
            for i, segment in enumerate(segments, 1):
                start_time = format_srt_time(segment['start'])
                end_time = format_srt_time(segment['end'])
                text = segment['text']

                f.write(f"{i}\n")
                f.write(f"{start_time} --> {end_time}\n")
                f.write(f"{text}\n\n")

    @staticmethod
    def segments_to_text(segments: List[Dict]) -> str:
        """Конвертация сегментов в читаемый текст для LLM."""
        lines = []
        for seg in segments:
            timestamp = f"[{seg['start']:.1f}s - {seg['end']:.1f}s]"
            lines.append(f"{timestamp} {seg['text']}")
        return '\n'.join(lines)
