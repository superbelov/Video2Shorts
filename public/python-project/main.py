#!/usr/bin/env python3
"""
Video2Shorts — Автоматическая конвертация длинных видео в вертикальные шортсы.
Главный оркестратор пайплайна.

Использование:
    python main.py --input ./videos/ --output ./clips/ --config config.yaml
    python main.py --input video.mp4 --output ./clips/ --dry-run
"""

import argparse
import logging
import os
import sys
import json
import time
import hashlib
from pathlib import Path
from typing import List, Dict, Optional

import yaml
from tqdm import tqdm

from transcriber import Transcriber
from highlight_finder import HighlightFinder
from face_tracker import FaceTracker
from video_renderer import VideoRenderer

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('pipeline.log', encoding='utf-8')
    ]
)
logger = logging.getLogger('Video2Shorts')


class PipelineState:
    """Управление состоянием пайплайна для возможности возобновления."""

    def __init__(self, cache_dir: str):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.cache_dir / 'pipeline_state.json'
        self.state = self._load_state()

    def _load_state(self) -> dict:
        if self.state_file.exists():
            with open(self.state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'completed_videos': {}, 'current_video': None}

    def _save_state(self):
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)

    def get_video_hash(self, video_path: str) -> str:
        """Хеш файла для отслеживания изменений."""
        stat = os.stat(video_path)
        return hashlib.md5(f"{video_path}_{stat.st_mtime}_{stat.st_size}".encode()).hexdigest()

    def is_completed(self, video_path: str) -> bool:
        video_hash = self.get_video_hash(video_path)
        return video_hash in self.state['completed_videos']

    def mark_completed(self, video_path: str, results: dict):
        video_hash = self.get_video_hash(video_path)
        self.state['completed_videos'][video_hash] = {
            'path': video_path,
            'completed_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'results': results
        }
        self._save_state()

    def save_intermediate(self, video_path: str, stage: str, data: dict):
        """Сохранение промежуточных результатов."""
        video_hash = self.get_video_hash(video_path)
        stage_file = self.cache_dir / f"{video_hash}_{stage}.json"
        with open(stage_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_intermediate(self, video_path: str, stage: str) -> Optional[dict]:
        """Загрузка промежуточных результатов."""
        video_hash = self.get_video_hash(video_path)
        stage_file = self.cache_dir / f"{video_hash}_{stage}.json"
        if stage_file.exists():
            with open(stage_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None


def load_config(config_path: str) -> dict:
    """Загрузка конфигурации из YAML файла."""
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    return config


def find_video_files(input_path: str) -> List[str]:
    """Рекурсивный поиск видеофайлов в папке."""
    video_extensions = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'}
    input_path = Path(input_path)

    if input_path.is_file():
        if input_path.suffix.lower() in video_extensions:
            return [str(input_path)]
        else:
            logger.warning(f"Файл {input_path} не является видеофайлом")
            return []

    videos = []
    for ext in video_extensions:
        videos.extend([str(p) for p in input_path.rglob(f'*{ext}')])

    videos.sort()
    logger.info(f"Найдено {len(videos)} видеофайлов")
    return videos


def process_video(
    video_path: str,
    output_dir: str,
    config: dict,
    state: PipelineState,
    dry_run: bool = False
) -> Dict:
    """Обработка одного видеофайла через весь пайплайн."""

    video_name = Path(video_path).stem
    video_output_dir = Path(output_dir) / video_name
    video_output_dir.mkdir(parents=True, exist_ok=True)

    results = {
        'video': video_path,
        'highlights': [],
        'clips': [],
        'status': 'pending'
    }

    logger.info(f"{'='*60}")
    logger.info(f"Обработка: {video_path}")
    logger.info(f"{'='*60}")

    # === ЭТАП 1: Транскрибация ===
    logger.info("[1/4] Транскрибация аудио...")

    cached_transcript = state.load_intermediate(video_path, 'transcript')
    if cached_transcript:
        logger.info("Используем кэшированную транскрибацию")
        transcript_data = cached_transcript
    else:
        transcriber = Transcriber(
            model_size=config['transcription']['model'],
            language=config['transcription']['language'],
            device=config['transcription']['device'],
            compute_type=config['transcription']['compute_type']
        )

        # Разбиение длинных видео на части
        max_duration = config['transcription'].get('max_chunk_minutes', 5) * 60
        transcript_data = transcriber.transcribe(
            video_path,
            output_dir=str(video_output_dir),
            max_chunk_seconds=max_duration
        )

        state.save_intermediate(video_path, 'transcript', transcript_data)

    logger.info(f"Транскрибация завершена. Найдено {len(transcript_data.get('segments', []))} сегментов")

    if dry_run:
        # Сохраняем превью транскрипта
        preview_path = video_output_dir / 'transcript_preview.json'
        with open(preview_path, 'w', encoding='utf-8') as f:
            json.dump(transcript_data, f, ensure_ascii=False, indent=2)
        logger.info(f"Превью транскрипта: {preview_path}")

    # === ЭТАП 2: Поиск хайлайтов ===
    logger.info("[2/4] Поиск вирусных фрагментов через LLM...")

    cached_highlights = state.load_intermediate(video_path, 'highlights')
    if cached_highlights:
        logger.info("Используем кэшированные хайлайты")
        highlights = cached_highlights
    else:
        finder = HighlightFinder(
            ollama_url=config['llm']['ollama_url'],
            model=config['llm']['model'],
            min_duration=config['highlights']['min_duration'],
            max_duration=config['highlights']['max_duration'],
            num_highlights=config['highlights']['count']
        )

        highlights = finder.find_highlights(transcript_data)
        state.save_intermediate(video_path, 'highlights', highlights)

    logger.info(f"Найдено {len(highlights)} хайлайтов:")
    for i, h in enumerate(highlights):
        logger.info(f"  [{i+1}] {h['start']:.1f}s - {h['end']:.1f}s | {h.get('reason', '')}")

    results['highlights'] = highlights

    if dry_run:
        logger.info("[DRY RUN] Пропускаем трекинг и рендеринг")
        results['status'] = 'dry_run_complete'
        return results

    # === ЭТАП 3: Трекинг лица ===
    logger.info("[3/4] Трекинг лица/спикера...")

    cached_tracking = state.load_intermediate(video_path, 'tracking')
    if cached_tracking:
        logger.info("Используем кэшированные данные трекинга")
        tracking_data = cached_tracking
    else:
        tracker = FaceTracker(
            model_path=config['tracking']['model'],
            smoothing_method=config['tracking']['smoothing'],
            smoothing_window=config['tracking']['smoothing_window']
        )

        tracking_data = tracker.track(video_path)
        state.save_intermediate(video_path, 'tracking', tracking_data)

    logger.info(f"Трекинг завершено. {len(tracking_data.get('frames', []))} кадров обработано")

    # === ЭТАП 4: Рендеринг ===
    logger.info("[4/4] Рендеринг вертикальных клипов...")

    renderer = VideoRenderer(
        output_width=config['render']['width'],
        output_height=config['render']['height'],
        fps=config['render']['fps'],
        subtitle_style=config['render']['subtitle_style']
    )

    clips = []
    test_clips_dir = video_output_dir / 'test_clips'
    test_clips_dir.mkdir(exist_ok=True)

    for i, highlight in enumerate(tqdm(highlights, desc="Рендеринг клипов")):
        clip_filename = f"clip_{i+1:02d}_{highlight['start']:.0f}s-{highlight['end']:.0f}s.mp4"
        clip_path = video_output_dir / clip_filename

        # Получаем координаты трекинга для данного сегмента
        segment_tracking = tracker.get_coordinates_for_segment(
            tracking_data,
            highlight['start'],
            highlight['end']
        )

        # Получаем путь к SRT файлу
        srt_path = video_output_dir / f"{video_name}.srt"

        # Рендерим клип
        renderer.render_clip(
            input_video=video_path,
            output_path=str(clip_path),
            start_time=highlight['start'],
            end_time=highlight['end'],
            tracking_data=segment_tracking,
            srt_path=str(srt_path) if srt_path.exists() else None
        )

        clips.append(str(clip_path))
        logger.info(f"  Клип {i+1}: {clip_path}")

        # Сохраняем тестовый клип (первые 5 секунд)
        test_clip_path = test_clips_dir / f"test_{clip_filename}"
        renderer.render_clip(
            input_video=video_path,
            output_path=str(test_clip_path),
            start_time=highlight['start'],
            end_time=min(highlight['start'] + 5, highlight['end']),
            tracking_data=segment_tracking,
            srt_path=str(srt_path) if srt_path.exists() else None
        )

    results['clips'] = clips
    results['status'] = 'completed'

    # Отмечаем видео как обработанное
    state.mark_completed(video_path, {
        'num_clips': len(clips),
        'highlights_count': len(highlights)
    })

    logger.info(f"Готово! Создано {len(clips)} клипов в {video_output_dir}")
    return results


def main():
    parser = argparse.ArgumentParser(
        description='Video2Shorts — Конвертация длинных видео в вертикальные шортсы'
    )
    parser.add_argument(
        '--input', '-i',
        required=True,
        help='Путь к видеофайлу или папке с видео'
    )
    parser.add_argument(
        '--output', '-o',
        default='./clips/',
        help='Папка для выходных клипов (по умолчанию: ./clips/)'
    )
    parser.add_argument(
        '--config', '-c',
        default='config.yaml',
        help='Путь к файлу конфигурации (по умолчанию: config.yaml)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Режим тестирования без рендеринга видео'
    )
    parser.add_argument(
        '--resume',
        action='store_true',
        help='Возобновить с последнего прерванного места'
    )
    parser.add_argument(
        '--clear-cache',
        action='store_true',
        help='Очистить кэш перед запуском'
    )
    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='Уровень логирования'
    )

    args = parser.parse_args()

    # Устанавливаем уровень логирования
    logging.getLogger().setLevel(getattr(logging, args.log_level))

    # Загрузка конфигурации
    config = load_config(args.config)
    logger.info(f"Конфигурация загружена из {args.config}")

    # Инициализация состояния
    cache_dir = config.get('cache_dir', './cache/')
    state = PipelineState(cache_dir)

    if args.clear_cache:
        import shutil
        if os.path.exists(cache_dir):
            shutil.rmtree(cache_dir)
            logger.info("Кэш очищен")

    # Поиск видеофайлов
    video_files = find_video_files(args.input)

    if not video_files:
        logger.error("Видеофайлы не найдены!")
        sys.exit(1)

    # Фильтрация уже обработанных видео
    if args.resume:
        video_files = [v for v in video_files if not state.is_completed(v)]
        logger.info(f"Пропущено обработанных: {len(find_video_files(args.input)) - len(video_files)}")

    if not video_files:
        logger.info("Все видео уже обработаны!")
        sys.exit(0)

    # Создание выходной директории
    os.makedirs(args.output, exist_ok=True)

    # Обработка всех видео
    all_results = []
    for video_path in tqdm(video_files, desc="Обработка видео"):
        try:
            result = process_video(
                video_path=video_path,
                output_dir=args.output,
                config=config,
                state=state,
                dry_run=args.dry_run
            )
            all_results.append(result)
        except Exception as e:
            logger.error(f"Ошибка при обработке {video_path}: {e}", exc_info=True)
            all_results.append({
                'video': video_path,
                'status': 'error',
                'error': str(e)
            })

    # Итоговая статистика
    logger.info(f"\n{'='*60}")
    logger.info("ИТОГОВАЯ СТАТИСТИКА")
    logger.info(f"{'='*60}")
    logger.info(f"Всего видео: {len(all_results)}")
    logger.info(f"Успешно: {sum(1 for r in all_results if r['status'] in ('completed', 'dry_run_complete'))}")
    logger.info(f"Ошибки: {sum(1 for r in all_results if r['status'] == 'error')}")

    total_clips = sum(len(r.get('clips', [])) for r in all_results)
    logger.info(f"Всего клипов: {total_clips}")

    # Сохранение итогового отчёта
    report_path = Path(args.output) / 'report.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    logger.info(f"Отчёт сохранён: {report_path}")


if __name__ == '__main__':
    main()
