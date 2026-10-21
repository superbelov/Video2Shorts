#!/usr/bin/env python3
"""
Тестовый скрипт для модуля трекинга лица.
Запуск: python test_tracker.py --input video.mp4
"""

import argparse
import json
import logging
import sys
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description='Тест трекинга лица')
    parser.add_argument('--input', '-i', required=True, help='Путь к видеофайлу')
    parser.add_argument('--model', default='yolov8n.pt', help='Модель YOLOv8')
    parser.add_argument('--smoothing', default='kalman', help='Метод сглаживания')
    args = parser.parse_args()

    from face_tracker import FaceTracker

    logger.info(f"Тест трекинга: {args.input}")
    logger.info(f"Модель: {args.model}, Сглаживание: {args.smoothing}")

    tracker = FaceTracker(
        model_path=args.model,
        smoothing_method=args.smoothing
    )

    start_time = time.time()
    result = tracker.track(args.input)
    elapsed = time.time() - start_time

    # Статистика
    frames = result['frames']
    logger.info(f"\n{'='*50}")
    logger.info("РЕЗУЛЬТАТЫ ТРЕКИНГА")
    logger.info(f"{'='*50}")
    logger.info(f"Время: {elapsed:.1f}с")
    logger.info(f"Кадров обработано: {len(frames)}")
    logger.info(f"Видео: {result['width']}x{result['height']}, {result['fps']}fps")

    if frames:
        x_values = [f['smooth_x'] for f in frames]
        y_values = [f['smooth_y'] for f in frames]

        logger.info(f"\nКоординаты X: min={min(x_values):.0f}, max={max(x_values):.0f}, "
                    f"avg={sum(x_values)/len(x_values):.0f}")
        logger.info(f"Координаты Y: min={min(y_values):.0f}, max={max(y_values):.0f}, "
                    f"avg={sum(y_values)/len(y_values):.0f}")

        # Проверяем плавность (джиттер)
        if len(frames) > 1:
            dx = [abs(frames[i+1]['smooth_x'] - frames[i]['smooth_x'])
                  for i in range(len(frames)-1)]
            dy = [abs(frames[i+1]['smooth_y'] - frames[i]['smooth_y'])
                  for i in range(len(frames)-1)]

            logger.info(f"\nПлавность (среднее изменение за кадр):")
            logger.info(f"  X: {sum(dx)/len(dx):.1f} px")
            logger.info(f"  Y: {sum(dy)/len(dy):.1f} px")

        logger.info(f"\nПервые 10 точек:")
        for f in frames[:10]:
            logger.info(f"  t={f['timestamp']:.1f}s: raw=({f['raw_x']:.0f},{f['raw_y']:.0f}) "
                       f"→ smooth=({f['smooth_x']:.0f},{f['smooth_y']:.0f})")

    # Сохранение
    output_path = './test_output/tracking_test_result.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    logger.info(f"\nПолный результат: {output_path}")
    logger.info("✅ Тест завершён успешно!")


if __name__ == '__main__':
    main()
