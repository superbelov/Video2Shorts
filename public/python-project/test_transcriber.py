#!/usr/bin/env python3
"""
Тестовый скрипт для модуля транскрибации.
Запуск: python test_transcriber.py --input video.mp4
"""

import argparse
import json
import logging
import sys
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description='Тест транскрибации')
    parser.add_argument('--input', '-i', required=True, help='Путь к видеофайлу')
    parser.add_argument('--model', default='medium', help='Модель Whisper')
    parser.add_argument('--language', default='ru', help='Язык')
    parser.add_argument('--device', default='auto', help='Устройство (auto/cuda/cpu)')
    args = parser.parse_args()

    from transcriber import Transcriber

    logger.info(f"Тест транскрибации: {args.input}")
    logger.info(f"Модель: {args.model}, Язык: {args.language}")

    transcriber = Transcriber(
        model_size=args.model,
        language=args.language,
        device=args.device
    )

    start_time = time.time()
    result = transcriber.transcribe(args.input, output_dir='./test_output/')
    elapsed = time.time() - start_time

    # Статистика
    logger.info(f"\n{'='*50}")
    logger.info("РЕЗУЛЬТАТЫ ТРАНСКРИБАЦИИ")
    logger.info(f"{'='*50}")
    logger.info(f"Время: {elapsed:.1f}с")
    logger.info(f"Сегментов: {len(result['segments'])}")
    logger.info(f"Слов: {len(result['words'])}")
    logger.info(f"Длительность видео: {result['duration']:.1f}с")
    logger.info(f"\nПервые 5 сегментов:")

    for i, seg in enumerate(result['segments'][:5]):
        logger.info(f"  [{seg['start']:.1f}s - {seg['end']:.1f}s] {seg['text']}")

    # Сохранение результата
    output_path = './test_output/transcription_test_result.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    logger.info(f"\nПолный результат: {output_path}")
    logger.info("✅ Тест завершён успешно!")


if __name__ == '__main__':
    main()
