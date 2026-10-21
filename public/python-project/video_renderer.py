#!/usr/bin/env python3
"""
Модуль рендеринга вертикальных клипов через FFmpeg.
Генерирует сложные фильтры filter_complex для динамического кропа и субтитров.
"""

import logging
import os
import subprocess
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class VideoRenderer:
    """Рендеринг вертикальных клипов через FFmpeg."""

    def __init__(
        self,
        output_width: int = 1080,
        output_height: int = 1920,
        fps: int = 30,
        subtitle_style: Optional[Dict] = None
    ):
        self.output_width = output_width
        self.output_height = output_height
        self.fps = fps
        self.subtitle_style = subtitle_style or {
            'font': 'Arial',
            'fontsize': 42,
            'fontcolor': 'white',
            'borderstyle': 1,
            'outline': 3,
            'shadow': 2,
            'outlinecolor': 'black',
            'shadowcolor': 'black',
            'margin_v': 150,
            'alignment': 2,
            'bold': 1
        }

    def _build_crop_filter(
        self,
        input_width: int,
        input_height: int,
        tracking_data: List[Dict]
    ) -> str:
        """
        Построение фильтра динамического кропа.

        Логика:
        1. Вычисляем ширину кропа: crop_w = input_height * 9/16
        2. Позиция X определяется координатой спикера (smooth_x)
        3. Позиция Y — всегда по центру (вертикальный кроп)
        """
        # Ширина вертикального кропа
        crop_width = int(input_height * 9 / 16)

        # Ограничиваем crop_width размером исходного видео
        crop_width = min(crop_width, input_width)

        # Максимальное смещение X
        max_x = max(0, input_width - crop_width)

        if not tracking_data:
            # Статичный кроп по центру
            x_pos = max_x // 2
            return f"crop={crop_width}:{input_height}:{x_pos}:0"

        # Генерируем выражение для динамического X
        # Используем enable-выражение FFmpeg для каждого кадра
        if len(tracking_data) == 1:
            # Один кадр — статичный кроп
            speaker_x = tracking_data[0].get('smooth_x', input_width / 2)
            x_pos = self._calculate_x_position(speaker_x, crop_width, input_width)
            return f"crop={crop_width}:{input_height}:{x_pos}:0"

        # Динамический кроп через sendcmd + crop
        # Генерируем команды для каждого ключевых кадров
        commands = []
        for point in tracking_data:
            speaker_x = point.get('smooth_x', input_width / 2)
            x_pos = self._calculate_x_position(speaker_x, crop_width, input_width)
            timestamp = point['timestamp']
            commands.append(f"{timestamp} crop x {x_pos}")

        # Записываем команды во временный файл
        cmd_file = '/tmp/crop_commands.txt'
        with open(cmd_file, 'w') as f:
            f.write('; '.join(commands))

        return f"sendcmd=f={cmd_file},crop={crop_width}:{input_height}"

    def _calculate_x_position(
        self,
        speaker_x: float,
        crop_width: int,
        input_width: int
    ) -> int:
        """Вычисление позиции X кропа так, чтобы спикер был в центре."""
        # Позиция X = speaker_x - crop_width/2, ограниченная границами
        x_pos = int(speaker_x - crop_width / 2)
        max_x = max(0, input_width - crop_width)
        x_pos = max(0, min(x_pos, max_x))
        return x_pos

    def _build_subtitle_filter(self, srt_path: str, start_time: float) -> str:
        """Построение фильтра субтитров."""
        if not srt_path or not os.path.exists(srt_path):
            return ""

        style = self.subtitle_style

        # Формируем строку стиля ASS
        force_style = (
            f"FontName={style['font']},"
            f"FontSize={style['fontsize']},"
            f"PrimaryColour=&H00FFFFFF,"
            f"OutlineColour=&H00000000,"
            f"ShadowColour=&H00000000,"
            f"BorderStyle={style['borderstyle']},"
            f"Outline={style['outline']},"
            f"Shadow={style['shadow']},"
            f"MarginV={style['margin_v']},"
            f"Alignment={style['alignment']},"
            f"Bold={style['bold']}"
        )

        # Экранируем путь для FFmpeg
        escaped_path = srt_path.replace('\\', '/').replace(':', '\\:')

        return f"subtitles='{escaped_path}':force_style='{force_style}'"

    def _build_scale_filter(self) -> str:
        """Фильтр масштабирования до целевого разрешения."""
        return f"scale={self.output_width}:{self.output_height}:flags=lanczos"

    def render_clip(
        self,
        input_video: str,
        output_path: str,
        start_time: float,
        end_time: float,
        tracking_data: List[Dict],
        srt_path: Optional[str] = None
    ):
        """
        Рендеринг одного вертикального клипа.

        Args:
            input_video: Путь к исходному видео
            output_path: Путь для выходного файла
            start_time: Начало клипа (секунды)
            end_time: Конец клипа (секунды)
            tracking_data: Данные трекинга для этого сегмента
            srt_path: Путь к SRT файлу субтитров
        """
        duration = end_time - start_time

        # Получаем информацию о видео
        video_info = self._get_video_info(input_video)
        input_width = video_info['width']
        input_height = video_info['height']

        # Строим цепочку фильтров
        filters = []

        # 1. Динамический кроп
        crop_filter = self._build_crop_filter(input_width, input_height, tracking_data)
        filters.append(crop_filter)

        # 2. Масштабирование
        filters.append(self._build_scale_filter())

        # 3. Субтитры
        if srt_path:
            sub_filter = self._build_subtitle_filter(srt_path, start_time)
            if sub_filter:
                filters.append(sub_filter)

        # Собираем filter_complex
        filter_chain = ','.join(filters)

        # Формируем команду FFmpeg
        cmd = [
            'ffmpeg',
            '-ss', str(start_time),
            '-i', input_video,
            '-t', str(duration),
            '-vf', filter_chain,
            '-r', str(self.fps),
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ar', '44100',
            '-movflags', '+faststart',
            '-y',
            output_path
        ]

        logger.info(f"Рендеринг клипа: {start_time:.1f}s - {end_time:.1f}s → {output_path}")
        logger.debug(f"FFmpeg команда: {' '.join(cmd)}")

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 минут таймаут
            )

            if result.returncode != 0:
                logger.error(f"FFmpeg ошибка: {result.stderr[-500:]}")

                # Fallback: пробуем без динамического кропа
                logger.info("Пробуем упрощённый рендеринг (статичный кроп)...")
                self._render_fallback(input_video, output_path, start_time, end_time,
                                     input_width, input_height, srt_path)
            else:
                logger.info(f"Клип сохранён: {output_path}")

        except subprocess.TimeoutExpired:
            logger.error("Таймаут рендеринга!")
            raise
        except Exception as e:
            logger.error(f"Ошибка рендеринга: {e}")
            raise

    def _render_fallback(
        self,
        input_video: str,
        output_path: str,
        start_time: float,
        end_time: float,
        input_width: int,
        input_height: int,
        srt_path: Optional[str] = None
    ):
        """Упрощённый рендеринг с центральным статичным кропом."""
        crop_width = int(input_height * 9 / 16)
        crop_width = min(crop_width, input_width)
        x_pos = max(0, (input_width - crop_width) // 2)

        filters = [f"crop={crop_width}:{input_height}:{x_pos}:0"]
        filters.append(self._build_scale_filter())

        if srt_path:
            sub_filter = self._build_subtitle_filter(srt_path, start_time)
            if sub_filter:
                filters.append(sub_filter)

        filter_chain = ','.join(filters)

        cmd = [
            'ffmpeg',
            '-ss', str(start_time),
            '-i', input_video,
            '-t', str(end_time - start_time),
            '-vf', filter_chain,
            '-r', str(self.fps),
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '20',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-y',
            output_path
        ]

        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=300)
        logger.info(f"Fallback клип сохранён: {output_path}")

    def _get_video_info(self, video_path: str) -> Dict:
        """Получение информации о видео через ffprobe."""
        cmd = [
            'ffprobe', '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height,r_frame_rate,duration',
            '-show_entries', 'format=duration',
            '-of', 'json',
            video_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, check=True)

        import json
        info = json.loads(result.stdout)

        stream = info.get('streams', [{}])[0]
        width = stream.get('width', 1920)
        height = stream.get('height', 1080)

        return {
            'width': width,
            'height': height,
            'duration': float(info.get('format', {}).get('duration', 0))
        }
