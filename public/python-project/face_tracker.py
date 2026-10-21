#!/usr/bin/env python3
"""
Модуль трекинга лица/спикера.
Использует YOLOv8 (ultralytics) для детекции людей и MediaPipe для лица.
Применяет фильтр Калмана для сглаживания координат.
"""

import logging
import math
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from tqdm import tqdm

logger = logging.getLogger(__name__)


class KalmanFilter2D:
    """Фильтр Калмана для сглаживания 2D координат."""

    def __init__(self, process_noise: float = 1.0, measurement_noise: float = 1.0):
        # Состояние: [x, y, vx, vy]
        self.state = np.array([0.0, 0.0, 0.0, 0.0])

        # Матрица перехода состояния
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

        # Ковариация состояния
        self.P = np.eye(4) * 1000

        # Шум процесса
        self.Q = np.eye(4) * process_noise

        # Шум измерения
        self.R = np.eye(2) * measurement_noise

        self.initialized = False

    def update(self, measurement: Tuple[float, float]) -> Tuple[float, float]:
        """Обновление фильтра новым измерением."""
        z = np.array(measurement, dtype=np.float64)

        if not self.initialized:
            self.state[:2] = z
            self.initialized = True
            return tuple(self.state[:2])

        # Prediction
        self.state = self.F @ self.state
        self.P = self.F @ self.P @ self.F.T + self.Q

        # Update
        y = z - self.H @ self.state
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)

        self.state = self.state + K @ y
        self.P = (np.eye(4) - K @ self.H) @ self.P

        return tuple(self.state[:2])

    def reset(self):
        """Сброс фильтра."""
        self.state = np.array([0.0, 0.0, 0.0, 0.0])
        self.P = np.eye(4) * 1000
        self.initialized = False


class MovingAverageSmoother:
    """Сглаживание скользящим средним."""

    def __init__(self, window_size: int = 15):
        self.window_size = window_size
        self.x_buffer = []
        self.y_buffer = []

    def update(self, x: float, y: float) -> Tuple[float, float]:
        self.x_buffer.append(x)
        self.y_buffer.append(y)

        if len(self.x_buffer) > self.window_size:
            self.x_buffer.pop(0)
            self.y_buffer.pop(0)

        smooth_x = sum(self.x_buffer) / len(self.x_buffer)
        smooth_y = sum(self.y_buffer) / len(self.y_buffer)

        return smooth_x, smooth_y


class FaceTracker:
    """Трекинг лица/спикера в видео."""

    def __init__(
        self,
        model_path: str = 'yolov8n.pt',
        smoothing_method: str = 'kalman',
        smoothing_window: int = 15,
        confidence_threshold: float = 0.5
    ):
        self.model_path = model_path
        self.smoothing_method = smoothing_method
        self.smoothing_window = smoothing_window
        self.confidence_threshold = confidence_threshold
        self.model = None
        self.face_cascade = None

    def _load_model(self):
        """Загрузка модели YOLOv8."""
        if self.model is not None:
            return

        logger.info(f"Загрузка модели YOLOv8: {self.model_path}")

        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
            logger.info("YOLOv8 модель загружена")
        except ImportError:
            raise ImportError(
                "ultralytics не установлен. Установите: pip install ultralytics"
            )

        # Загрузка каскада Хаара для лица (как fallback)
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)

    def _detect_persons(self, frame: np.ndarray) -> List[Dict]:
        """Детекция людей в кадре через YOLOv8."""
        results = self.model(frame, verbose=False, conf=self.confidence_threshold)

        persons = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])

                # Класс 0 = person в COCO
                if cls == 0:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2
                    width = x2 - x1
                    height = y2 - y1
                    area = width * height

                    persons.append({
                        'bbox': (x1, y1, x2, y2),
                        'center': (center_x, center_y),
                        'area': area,
                        'confidence': conf
                    })

        return persons

    def _detect_face(self, frame: np.ndarray) -> Optional[Tuple[float, float]]:
        """Детекция лица через каскад Хаара."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )

        if len(faces) > 0:
            # Берём самое большое лицо
            largest = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = largest
            center_x = x + w / 2
            center_y = y + h / 2
            return (center_x, center_y)

        return None

    def _select_speaker(
        self,
        persons: List[Dict],
        frame: np.ndarray,
        frame_idx: int
    ) -> Optional[Tuple[float, float]]:
        """
        Выбор говорящего спикера из нескольких людей.
        Приоритет: 1) лицо обнаружено, 2) largest person, 3) центр кадра.
        """
        if not persons:
            return None

        if len(persons) == 1:
            return persons[0]['center']

        # Пробуем найти лицо
        face_center = self._detect_face(frame)
        if face_center:
            # Находим ближайшего человека к обнаруженному лицу
            min_dist = float('inf')
            closest = None
            for person in persons:
                dist = math.dist(face_center, person['center'])
                if dist < min_dist:
                    min_dist = dist
                    closest = person
            if closest and min_dist < 200:  # лицо должно быть внутри bounding box
                return closest['center']

        # Выбираем самого крупного человека
        largest = max(persons, key=lambda p: p['area'])
        return largest['center']

    def track(self, video_path: str) -> Dict:
        """
        Трекинг лица/спикера на всём видео.

        Args:
            video_path: Путь к видеофайлу

        Returns:
            Dict с данными трекинга:
            {
                'frames': [{'frame_idx': int, 'x': float, 'y': float, 'smooth_x': float, 'smooth_y': float}],
                'fps': float,
                'width': int,
                'height': int
            }
        """
        self._load_model()

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Не удалось открыть видео: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        logger.info(f"Видео: {width}x{height}, {fps}fps, {total_frames} кадров")

        # Инициализация сглаживания
        if self.smoothing_method == 'kalman':
            smoother = KalmanFilter2D(process_noise=2.0, measurement_noise=5.0)
        else:
            smoother = MovingAverageSmoother(window_size=self.smoothing_window)

        frames_data = []
        frame_idx = 0

        # Пропускаем каждый N-й кадр для скорости (потом интерполируем)
        step = max(1, int(fps / 10))  # 10 точек в секунду

        pbar = tqdm(total=total_frames, desc="Трекинг лица", unit="кадр")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % step == 0:
                # Детекция людей
                persons = self._detect_persons(frame)

                # Выбор спикера
                speaker_center = self._select_speaker(persons, frame, frame_idx)

                if speaker_center:
                    raw_x, raw_y = speaker_center
                else:
                    # Если никто не найден — центр кадра
                    raw_x = width / 2
                    raw_y = height / 2

                # Сглаживание
                smooth_x, smooth_y = smoother.update(raw_x, raw_y)

                frames_data.append({
                    'frame_idx': frame_idx,
                    'timestamp': frame_idx / fps,
                    'raw_x': round(raw_x, 1),
                    'raw_y': round(raw_y, 1),
                    'smooth_x': round(smooth_x, 1),
                    'smooth_y': round(smooth_y, 1)
                })

            pbar.update(step)
            frame_idx += step
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)

        cap.release()
        pbar.close()

        logger.info(f"Трекинг завершён: {len(frames_data)} точек")

        return {
            'frames': frames_data,
            'fps': fps,
            'width': width,
            'height': height,
            'total_frames': total_frames,
            'smoothing_method': self.smoothing_method
        }

    def get_coordinates_for_segment(
        self,
        tracking_data: Dict,
        start_time: float,
        end_time: float
    ) -> List[Dict]:
        """
        Получение сглаженных координат для конкретного сегмента.

        Args:
            tracking_data: Результат track()
            start_time: Начало сегмента (секунды)
            end_time: Конец сегмента (секунды)

        Returns:
            Список координат для каждого кадра сегмента
        """
        frames = tracking_data.get('frames', [])

        # Фильтрация по времени
        segment_frames = [
            f for f in frames
            if start_time <= f['timestamp'] <= end_time
        ]

        if not segment_frames:
            # Если нет данных для сегмента, используем центр
            width = tracking_data.get('width', 1920)
            height = tracking_data.get('height', 1080)
            return [{
                'timestamp': start_time,
                'smooth_x': width / 2,
                'smooth_y': height / 2
            }]

        return segment_frames
