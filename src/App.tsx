import { useState } from 'react';

const files = [
  { name: 'main.py', desc: 'Главный скрипт — запускает весь процесс' },
  { name: 'transcriber.py', desc: 'Модуль транскрибации (faster-whisper)' },
  { name: 'highlight_finder.py', desc: 'Поиск хайлайтов через LLM' },
  { name: 'face_tracker.py', desc: 'Трекинг лица (YOLOv8 + Калман)' },
  { name: 'video_renderer.py', desc: 'Рендеринг вертикальных клипов (FFmpeg)' },
  { name: 'config.yaml', desc: 'Настройки — что и как обрабатывать' },
  { name: 'requirements.txt', desc: 'Список Python-библиотек' },
  { name: 'install.sh', desc: 'Установка для Linux/Mac' },
  { name: 'install.bat', desc: 'Установка для Windows' },
  { name: 'test_transcriber.py', desc: 'Тест транскрибации' },
  { name: 'test_tracker.py', desc: 'Тест трекинга' },
  { name: 'README.md', desc: 'Документация' },
];

export default function App() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const Cmd = ({ id, text, comment }: { id: string; text: string; comment?: string }) => (
    <div className="bg-gray-950 rounded-lg p-3 font-mono text-sm group relative">
      {comment && <div className="text-gray-500 text-xs mb-1">{comment}</div>}
      <div className="flex items-center gap-2">
        <span className="text-green-400 select-none">$</span>
        <span className="text-gray-200 break-all flex-1">{text}</span>
        <button
          onClick={() => copy(text, id)}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 shrink-0"
        >
          {copied === id ? '✓' : '📋'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg flex items-center justify-center font-bold">
              V
            </div>
            <div>
              <h1 className="font-bold text-lg">Video2Shorts</h1>
              <p className="text-xs text-gray-400">Инструкция для локального использования</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Главная инструкция */}
        <div className="bg-gradient-to-br from-violet-900/20 to-pink-900/20 border border-violet-500/30 rounded-2xl p-6">
          <h2 className="text-2xl font-bold mb-3">📌 Что это за файлы?</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Это обычный <strong>Python-проект</strong>. Файлы ниже — это код, который вы запускаете
            у себя на ноутбуке через командную строку (терминал). Никакого сайта для работы не нужно.
          </p>
          <div className="bg-gray-950 rounded-lg p-4 text-sm">
            <div className="text-gray-400 mb-2">Как это работает:</div>
            <ol className="space-y-1 text-gray-300 list-decimal list-inside">
              <li>Скачиваете все файлы в одну папку на ноутбуке</li>
              <li>Устанавливаете Python и FFmpeg (один раз)</li>
              <li>Запускаете скрипт командой в терминале</li>
              <li>Получаете готовые вертикальные клипы</li>
            </ol>
          </div>
        </div>

        {/* Шаг 1: Скачать файлы */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-sm">1</span>
            Скачайте все файлы в одну папку
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Нажмите на каждый файл ниже — он скачается. Положите все файлы в одну папку, например <code className="text-violet-300">video2shorts</code> на Рабочем столе.
          </p>

          <div className="grid sm:grid-cols-2 gap-2">
            {files.map((file) => (
              <a
                key={file.name}
                href={`/python-project/${file.name}`}
                download
                className="flex items-center gap-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-violet-500/50 rounded-lg p-3 transition-all group"
              >
                <span className="text-xl">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">{file.name}</div>
                  <div className="text-xs text-gray-500 truncate">{file.desc}</div>
                </div>
                <span className="text-gray-600 group-hover:text-violet-400">⬇️</span>
              </a>
            ))}
          </div>

          <div className="mt-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-200">
            💡 <strong>Совет:</strong> Создайте папку <code>video2shorts</code> на Рабочем столе и скачайте все файлы туда.
          </div>
        </div>

        {/* Шаг 2: Установить Python */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-sm">2</span>
            Установите Python и FFmpeg
          </h2>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-gray-300 mb-2">🐍 Python (обязательно):</div>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Скачайте с <a href="https://python.org/downloads" target="_blank" className="text-violet-400 underline">python.org/downloads</a></li>
                <li>Версия <strong>3.10 или новее</strong></li>
                <li className="text-yellow-300">⚠️ При установке отметьте галочку <strong>"Add Python to PATH"</strong></li>
              </ul>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-300 mb-2">🎬 FFmpeg (обязательно):</div>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li><strong>Windows:</strong> скачайте с <a href="https://www.gyan.dev/ffmpeg/builds/" target="_blank" className="text-violet-400 underline">gyan.dev</a>, распакуйте, добавьте папку <code>bin</code> в PATH</li>
                <li><strong>Mac:</strong> <code className="text-green-400">brew install ffmpeg</code></li>
                <li><strong>Linux:</strong> <code className="text-green-400">sudo apt install ffmpeg</code></li>
              </ul>
            </div>

            <div className="bg-gray-950 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Проверьте установку:</div>
              <Cmd id="check-python" text="python --version" />
              <div className="mt-2">
                <Cmd id="check-ffmpeg" text="ffmpeg -version" />
              </div>
            </div>
          </div>
        </div>

        {/* Шаг 3: Открыть терминал */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-sm">3</span>
            Откройте терминал в папке с файлами
          </h2>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-gray-300 mb-2">🪟 Windows:</div>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Откройте папку <code>video2shorts</code> на Рабочем столе</li>
                <li>В адресной строке проводника напишите <code className="text-green-400">cmd</code> и нажмите Enter</li>
                <li>Или: правой кнопкой в папке → "Открыть в терминале"</li>
              </ol>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-300 mb-2">🍎 Mac:</div>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Откройте приложение "Терминал"</li>
                <li>Напишите <code className="text-green-400">cd </code> (с пробелом после cd)</li>
                <li>Перетащите папку <code>video2shorts</code> в Терминал, нажмите Enter</li>
              </ol>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-300 mb-2">🐧 Linux:</div>
              <div className="text-sm text-gray-400">
                Правой кнопкой в папке → "Открыть в терминале"
              </div>
            </div>

            <div className="bg-gray-950 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Вы должны увидеть что-то вроде:</div>
              <div className="text-green-400 font-mono text-sm">
                C:\Users\ВашеИмя\Desktop\video2shorts&gt;
              </div>
              <div className="text-xs text-gray-500 mt-2">
                или на Mac/Linux: <code className="text-green-400">~/Desktop/video2shorts$</code>
              </div>
            </div>
          </div>
        </div>

        {/* Шаг 4: Установка зависимостей */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-sm">4</span>
            Установите зависимости (один раз)
          </h2>

          <div className="space-y-3">
            <div className="text-sm text-gray-400">
              В терминале, находясь в папке с файлами, выполните:
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-200">
              🪟 <strong>Windows:</strong>
            </div>
            <Cmd id="win-install" text="install.bat" />

            <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-3 text-sm text-gray-300 mt-3">
              🍎 <strong>Mac / 🐧 Linux:</strong>
            </div>
            <Cmd id="mac-install-1" text="chmod +x install.sh" />
            <Cmd id="mac-install-2" text="./install.sh" />

            <div className="text-sm text-gray-400 mt-3">
              Что делает скрипт:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-500">
                <li>Создаёт виртуальное окружение <code>venv/</code></li>
                <li>Устанавливает все нужные библиотеки</li>
                <li>Скачивает модели Whisper и YOLOv8</li>
              </ul>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-200">
              ⏱️ Установка занимает 5-15 минут в зависимости от интернета.
            </div>
          </div>
        </div>

        {/* Шаг 5: Запуск */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-sm">5</span>
            Запустите обработку видео!
          </h2>

          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              Положите ваше видео в папку <code>video2shorts</code> (рядом с Python-файлами).
            </div>

            <div className="bg-gray-950 rounded-lg p-4 space-y-3">
              <div className="text-xs text-gray-500">Сначала активируйте окружение:</div>

              <div className="bg-gray-800/30 rounded p-2 text-xs text-gray-400">🪟 Windows:</div>
              <Cmd id="win-activate" text="venv\Scripts\activate" />

              <div className="bg-gray-800/30 rounded p-2 text-xs text-gray-400 mt-3">🍎 Mac / 🐧 Linux:</div>
              <Cmd id="mac-activate" text="source venv/bin/activate" />
            </div>

            <div className="bg-gray-950 rounded-lg p-4 space-y-3">
              <div className="text-xs text-gray-500">Теперь запустите скрипт:</div>

              <div className="text-xs text-green-400 mb-1"># Тестовый запуск (быстро, без рендеринга):</div>
              <Cmd id="run-dry" text="python main.py --input video.mp4 --dry-run" />

              <div className="text-xs text-green-400 mb-1 mt-3"># Полная обработка:</div>
              <Cmd id="run-full" text="python main.py --input video.mp4 --output ./clips/" />

              <div className="text-xs text-green-400 mb-1 mt-3"># Обработать все видео в папке:</div>
              <Cmd id="run-folder" text="python main.py --input ./videos/ --output ./clips/" />
            </div>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-sm text-green-200">
              ✅ Готово! Через несколько минут в папке <code>clips/</code> появятся вертикальные клипы.
            </div>
          </div>
        </div>

        {/* Где результат */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-sm">6</span>
            Где найти результат?
          </h2>

          <div className="text-sm text-gray-400 mb-4">
            После обработки откройте папку <code className="text-violet-300">clips/</code> — там будут готовые вертикальные видео.
          </div>

          <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-gray-300">
{`clips/
├── report.json              ← отчёт
└── video/                   ← папка для вашего видео
    ├── video.srt            ← субтитры
    ├── clip_01_120s-165s.mp4  ← готовый клип #1
    ├── clip_02_340s-395s.mp4  ← готовый клип #2
    └── clip_03_580s-630s.mp4  ← готовый клип #3`}
          </div>

          <div className="mt-4 text-sm text-gray-400">
            Клипы можно сразу загружать в TikTok, Instagram Reels или VK Клипы — они уже в формате 9:16 (1080×1920).
          </div>
        </div>

        {/* Частые проблемы */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">🔧 Если что-то не работает</h2>

          <div className="space-y-3">
            {[
              {
                q: '"python" не является командой',
                a: 'Python не установлен или не добавлен в PATH. Переустановите Python с python.org, отметив "Add to PATH".'
              },
              {
                q: '"ffmpeg" не найден',
                a: 'FFmpeg не установлен. Скачайте с gyan.dev (Windows) или установите через brew (Mac).'
              },
              {
                q: 'Ошибка при установке библиотек',
                a: 'Убедитесь, что активировали venv. Проверьте версию Python: python --version (нужна 3.10+).'
              },
              {
                q: 'Медленно работает',
                a: 'Это нормально на CPU. С NVIDIA GPU будет в 5-10 раз быстрее. В config.yaml можно поставить model: "small" для ускорения.'
              },
              {
                q: 'Нет Ollama — как искать хайлайты?',
                a: 'Без Ollama работает fallback-алгоритм (по эвристикам). Для AI-поиска установите Ollama с ollama.com и выполните: ollama pull qwen2.5:14b'
              },
            ].map((item, i) => (
              <details key={i} className="bg-gray-800/50 rounded-lg overflow-hidden group">
                <summary className="p-3 cursor-pointer text-sm font-medium text-gray-200 hover:bg-gray-800 transition-colors">
                  ❌ {item.q}
                </summary>
                <div className="p-3 pt-0 text-sm text-gray-400">
                  → {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Краткая шпаргалка */}
        <div className="bg-gradient-to-br from-violet-900/30 to-pink-900/30 border border-violet-500/20 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">⚡ Краткая шпаргалка</h2>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between bg-gray-950/50 rounded-lg p-3">
              <span className="text-gray-400">Активировать окружение (Windows):</span>
              <code className="text-green-400 text-xs">venv\Scripts\activate</code>
            </div>
            <div className="flex items-center justify-between bg-gray-950/50 rounded-lg p-3">
              <span className="text-gray-400">Активировать окружение (Mac/Linux):</span>
              <code className="text-green-400 text-xs">source venv/bin/activate</code>
            </div>
            <div className="flex items-center justify-between bg-gray-950/50 rounded-lg p-3">
              <span className="text-gray-400">Тест без рендеринга:</span>
              <code className="text-green-400 text-xs">python main.py -i video.mp4 --dry-run</code>
            </div>
            <div className="flex items-center justify-between bg-gray-950/50 rounded-lg p-3">
              <span className="text-gray-400">Полная обработка:</span>
              <code className="text-green-400 text-xs">python main.py -i video.mp4 -o ./clips/</code>
            </div>
            <div className="flex items-center justify-between bg-gray-950/50 rounded-lg p-3">
              <span className="text-gray-400">Возобновить после прерывания:</span>
              <code className="text-green-400 text-xs">python main.py -i ./videos/ --resume</code>
            </div>
            <div className="flex items-center justify-between bg-gray-950/50 rounded-lg p-3">
              <span className="text-gray-400">Подробные логи:</span>
              <code className="text-green-400 text-xs">python main.py -i video.mp4 --log-level DEBUG</code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-8 border-t border-gray-800">
          <p>Video2Shorts — все файлы Python-проекта выше</p>
          <p className="mt-1">Скачайте → установите → запустите. Готово!</p>
        </div>
      </div>
    </div>
  );
}
