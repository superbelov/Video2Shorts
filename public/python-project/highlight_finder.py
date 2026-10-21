#!/usr/bin/env python3
"""
Модуль поиска вирусных фрагментов (хайлайтов) через локальную LLM.
Использует Ollama с моделями qwen2.5 или llama3 для анализа транскрипта.
"""

import json
import logging
import re
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


HIGHLIGHT_PROMPT = """Ты — эксперт по созданию вирусных коротких видео для TikTok, Instagram Reels и YouTube Shorts.

Проанализируй транскрипт видео и найди {num_highlights} самых вирусных фрагментов.

КРИТЕРИИ ВИРУСНОСТИ:
1. ХУК В НАЧАЛЕ — первые 3-5 секунд должны цеплять внимание (вопрос, шок-факт, провокация)
2. ЭМОЦИЯ — фрагмент вызывает сильную эмоцию (удивление, смех, возмущение, вдохновение)
3. ЗАКОНЧЕННАЯ МЫСЛЬ — фрагмент содержит законченную идею, понятную без контекста
4. ДЛИНА — от {min_duration} до {max_duration} секунд

ТРАНСКРИПТ ВИДЕО:
---
{transcript}
---

ВЕРНИ РЕЗУЛЬТАТ СТРОГО В ФОРМАТЕ JSON (без markdown, без пояснений):
[
  {{
    "start": 120.5,
    "end": 165.0,
    "reason": "Краткое описание почему этот фрагмент вирусный",
    "hook": "Первая фраза-крючок",
    "score": 8.5
  }}
]

ВАЖНО:
- start и end — это секунды из таймкодов в транскрипте
- Фрагменты НЕ ДОЛЖНЫ пересекаться
- Сортируй по score (убывание)
- Минимум {num_highlights} фрагментов
"""


class HighlightFinder:
    """Поиск вирусных фрагментов через LLM."""

    def __init__(
        self,
        ollama_url: str = 'http://localhost:11434',
        model: str = 'qwen2.5:14b',
        min_duration: int = 30,
        max_duration: int = 60,
        num_highlights: int = 5
    ):
        self.ollama_url = ollama_url
        self.model = model
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.num_highlights = num_highlights

    def _call_ollama(self, prompt: str) -> str:
        """Вызов Ollama API."""
        try:
            import requests
        except ImportError:
            raise ImportError("requests не установлен. Установите: pip install requests")

        url = f"{self.ollama_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 2000
            }
        }

        logger.info(f"Отправка запроса к Ollama (модель: {self.model})...")

        try:
            response = requests.post(url, json=payload, timeout=300)
            response.raise_for_status()
            result = response.json()
            return result.get('response', '')
        except requests.exceptions.ConnectionError:
            raise ConnectionError(
                f"Не удалось подключиться к Ollama по адресу {self.ollama_url}. "
                "Убедитесь, что Ollama запущен: ollama serve"
            )
        except Exception as e:
            logger.error(f"Ошибка вызова Ollama: {e}")
            raise

    def _parse_llm_response(self, response: str) -> List[Dict]:
        """Парсинг JSON ответа от LLM."""
        # Попытка извлечь JSON из ответа
        json_match = re.search(r'\[[\s\S]*\]', response)

        if not json_match:
            logger.warning("Не удалось извлечь JSON из ответа LLM")
            logger.debug(f"Ответ LLM: {response}")
            return []

        try:
            highlights = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            logger.warning(f"Ошибка парсинга JSON: {e}")
            # Попытка исправить частые ошибки
            try:
                # Убираем trailing commas
                cleaned = re.sub(r',\s*]', ']', json_match.group())
                cleaned = re.sub(r',\s*}', '}', cleaned)
                highlights = json.loads(cleaned)
            except json.JSONDecodeError:
                logger.error("Не удалось исправить JSON")
                return []

        # Валидация и нормализация
        validated = []
        for h in highlights:
            if not isinstance(h, dict):
                continue
            if 'start' not in h or 'end' not in h:
                continue

            start = float(h['start'])
            end = float(h['end'])

            # Проверка длительности
            duration = end - start
            if duration < self.min_duration:
                logger.warning(f"Фрагмент слишком короткий ({duration:.1f}с), пропускаем")
                continue
            if duration > self.max_duration:
                end = start + self.max_duration
                logger.warning(f"Фрагмент обрезан до {self.max_duration}с")

            validated.append({
                'start': round(start, 1),
                'end': round(end, 1),
                'reason': h.get('reason', ''),
                'hook': h.get('hook', ''),
                'score': float(h.get('score', 5.0))
            })

        # Сортировка по score
        validated.sort(key=lambda x: x['score'], reverse=True)

        # Убираем пересечения
        validated = self._remove_overlaps(validated)

        return validated[:self.num_highlights]

    def _remove_overlaps(self, highlights: List[Dict]) -> List[Dict]:
        """Удаление пересекающихся фрагментов."""
        if not highlights:
            return []

        sorted_highlights = sorted(highlights, key=lambda x: x['start'])
        result = [sorted_highlights[0]]

        for h in sorted_highlights[1:]:
            last = result[-1]
            if h['start'] >= last['end']:
                result.append(h)
            else:
                logger.warning(
                    f"Пересечение фрагментов: [{last['start']}-{last['end']}] и "
                    f"[{h['start']}-{h['end']}]. Пропускаем второй."
                )

        return result

    def _fallback_find_highlights(self, segments: List[Dict]) -> List[Dict]:
        """
        Fallback-алгоритм поиска хайлайтов без LLM.
        Использует эвристики: длина предложений, наличие вопросов, паузы.
        """
        logger.warning("Используем fallback-алгоритм (без LLM)")

        scored_segments = []

        for i, seg in enumerate(segments):
            score = 0.0
            text = seg['text']

            # Наличие вопроса
            if '?' in text:
                score += 2.0

            # Восклицание (эмоция)
            if '!' in text:
                score += 1.5

            # Длина (средние предложения лучше)
            word_count = len(text.split())
            if 10 <= word_count <= 30:
                score += 1.0

            # Ключевые слова-маркеры
            hook_words = ['важно', 'смотрите', 'внимание', 'секрет', 'главное',
                         'никогда', 'всегда', 'ошибка', 'правда', 'шок']
            for word in hook_words:
                if word.lower() in text.lower():
                    score += 1.0

            scored_segments.append({
                'start': seg['start'],
                'end': seg['end'],
                'text': text,
                'score': score
            })

        # Сортировка по score
        scored_segments.sort(key=lambda x: x['score'], reverse=True)

        # Группировка в фрагменты нужной длины
        highlights = []
        used_ranges = []

        for seg in scored_segments:
            # Проверяем пересечение
            overlaps = False
            for start, end in used_ranges:
                if not (seg['end'] < start or seg['start'] > end):
                    overlaps = True
                    break

            if overlaps:
                continue

            # Расширяем до нужной длины
            start = max(0, seg['start'] - 5)  # Добавляем контекст в начале
            end = seg['end'] + 5

            # Ограничиваем длительность
            if end - start > self.max_duration:
                end = start + self.max_duration
            if end - start < self.min_duration:
                end = start + self.min_duration

            highlights.append({
                'start': round(start, 1),
                'end': round(end, 1),
                'reason': f"Fallback: score={seg['score']:.1f}",
                'hook': seg['text'][:50],
                'score': seg['score']
            })

            used_ranges.append((start, end))

            if len(highlights) >= self.num_highlights:
                break

        return highlights

    def find_highlights(self, transcript_data: Dict) -> List[Dict]:
        """
        Поиск хайлайтов в транскрипте.

        Args:
            transcript_data: Результат транскрибации

        Returns:
            Список хайлайтов: [{'start': float, 'end': float, 'reason': str, ...}]
        """
        segments = transcript_data.get('segments', [])

        if not segments:
            logger.error("Транскрипт пуст!")
            return []

        # Формируем текст для LLM
        from transcriber import Transcriber
        transcript_text = Transcriber.segments_to_text(segments)

        # Ограничиваем длину текста для LLM
        max_chars = 15000
        if len(transcript_text) > max_chars:
            transcript_text = transcript_text[:max_chars]
            logger.warning(f"Транскрипт обрезан до {max_chars} символов")

        # Формируем промпт
        prompt = HIGHLIGHT_PROMPT.format(
            num_highlights=self.num_highlights,
            min_duration=self.min_duration,
            max_duration=self.max_duration,
            transcript=transcript_text
        )

        # Вызов LLM
        try:
            response = self._call_ollama(prompt)
            highlights = self._parse_llm_response(response)

            if highlights:
                logger.info(f"LLM нашёл {len(highlights)} хайлайтов")
                return highlights
            else:
                logger.warning("LLM не вернул валидных хайлайтов, используем fallback")
                return self._fallback_find_highlights(segments)

        except Exception as e:
            logger.error(f"Ошибка при вызове LLM: {e}")
            logger.info("Переключаемся на fallback-алгоритм")
            return self._fallback_find_highlights(segments)
