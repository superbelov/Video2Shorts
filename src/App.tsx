import { useState } from 'react';

type OS = 'linux' | 'mac' | 'windows';

interface Step {
  num: number;
  title: string;
  icon: string;
  description: string;
  commands?: { cmd: string; comment?: string; copyable?: boolean }[];
  notes?: string[];
  warning?: string;
  tip?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors"
      title="Скопировать"
    >
      {copied ? '✓ Скопировано' : '📋 Копировать'}
    </button>
  );
}

function CommandBlock({ cmd, comment }: { cmd: string; comment?: string }) {
  return (
    <div className="relative bg-gray-950 rounded-lg p-3 font-mono text-sm group">
      {comment && <div className="text-gray-500 text-xs mb-1"># {comment}</div>}
      <div className="flex items-center gap-2">
        <span className="text-green-400 select-none">$</span>
        <span className="text-gray-200 break-all">{cmd}</span>
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(cmd)}
        className="absolute top-2 right-2 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        📋
      </button>
    </div>
  );
}

export default function App() {
  const [os, setOs] = useState<OS>('linux');
  const [activeStep, setActiveStep] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const steps: Record<OS, Step[]> = {
    linux: [
      {
        num: 1,
        title: 'Скачайте проект',
        icon: '📥',
        description: 'Склонируйте репозиторий или скачайте ZIP-архив с файлами проекта.',
        commands: [
          { cmd: 'git clone https://github.com/your-username/video2shorts.git', comment: 'Клонирование репозитория' },
          { cmd: 'cd video2shorts', comment: 'Переход в папку проекта' },
        ],
        notes: [
          'Если нет git — скачайте ZIP и распакуйте в любую папку',
          'Все файлы Python уже лежат в корне проекта'
        ],
        tip: 'Файлы проекта также доступны для скачивания прямо с этой страницы!'
      },
      {
        num: 2,
        title: 'Установите зависимости',
        icon: '⚙️',
        description: 'Запустите скрипт установки — он создаст виртуальное окружение и установит все библиотеки.',
        commands: [
          { cmd: 'chmod +x install.sh', comment: 'Делаем скрипт исполняемым' },
          { cmd: './install.sh', comment: 'Запуск установки' },
        ],
        notes: [
          'Скрипт автоматически проверит Python, FFmpeg, CUDA и Ollama',
          'Создаст виртуальное окружение venv/',
          'Скачает модели Whisper и YOLOv8',
          'Предложит скачать LLM-модель для Ollama'
        ],
        warning: 'Для GPU-ускорения нужны драйверы NVIDIA и CUDA Toolkit 12+'
      },
      {
        num: 3,
        title: 'Запустите Ollama (для AI-хайлайтов)',
        icon: '🧠',
        description: 'Ollama — это локальная LLM, которая анализирует транскрипт и находит вирусные фрагменты.',
        commands: [
          { cmd: 'ollama serve &', comment: 'Запуск Ollama в фоне' },
          { cmd: 'ollama pull qwen2.5:14b', comment: 'Скачивание модели (~9 ГБ)' },
        ],
        notes: [
          'Без Ollama скрипт всё равно работает — использует fallback-алгоритм',
          'Модель llama3:8b (~4.7 ГБ) — легче, но менее точная',
          'Первый запуск модели может быть медленным'
        ],
        tip: 'Если не хотите ставить Ollama — просто пропустите этот шаг!'
      },
      {
        num: 4,
        title: 'Подготовьте видео',
        icon: '📹',
        description: 'Положите ваши видео в папку. Поддерживаются любые форматы.',
        commands: [
          { cmd: 'mkdir -p videos', comment: 'Создаём папку для видео' },
          { cmd: 'cp /path/to/your/video.mp4 videos/', comment: 'Копируем видео' },
        ],
        notes: [
          'Поддерживаемые форматы: MP4, AVI, MKV, MOV, WMV, WebM',
          'Можно положить несколько видео — все обработаются',
          'Скрипт рекурсивно обходит вложенные папки'
        ]
      },
      {
        num: 5,
        title: 'Тестовый запуск (dry-run)',
        icon: '🧪',
        description: 'Сначала проверьте пайплайн без рендеринга — увидите найденные хайлайты и координаты.',
        commands: [
          { cmd: 'source venv/bin/activate', comment: 'Активация окружения' },
          { cmd: 'python main.py --input videos/video.mp4 --dry-run', comment: 'Тест без рендеринга' },
        ],
        notes: [
          'Покажет найденные хайлайты с таймкодами',
          'Проверит работу транскрибации и трекинга',
          'Не тратит время на рендеринг видео'
        ],
        tip: 'Результаты dry-run сохраняются в output/test_clips/'
      },
      {
        num: 6,
        title: 'Полная обработка!',
        icon: '🚀',
        description: 'Запустите полную конвертацию — скрипт создаст вертикальные клипы с субтитрами.',
        commands: [
          { cmd: 'python main.py --input ./videos/ --output ./clips/', comment: 'Обработка всех видео из папки' },
          { cmd: 'python main.py -i video.mp4 -o ./clips/ -c config.yaml', comment: 'Одно видео с кастомной конфигурацией' },
        ],
        notes: [
          'Результаты появятся в папке clips/',
          'Каждое видео → отдельная подпапка с клипами',
          'Прогресс отображается через tqdm',
          'Можно прервать (Ctrl+C) и возобновить с --resume'
        ],
        tip: 'Для длинных видео (>10 мин) скрипт автоматически разобьёт их на части'
      },
    ],
    mac: [
      {
        num: 1,
        title: 'Установите Homebrew и FFmpeg',
        icon: '🍺',
        description: 'На macOS проще всего установить FFmpeg через Homebrew.',
        commands: [
          { cmd: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', comment: 'Установка Homebrew (если нет)' },
          { cmd: 'brew install ffmpeg python@3.11', comment: 'Установка FFmpeg и Python' },
        ],
        notes: [
          'Homebrew — менеджер пакетов для macOS',
          'Python 3.11+ нужен для проекта'
        ]
      },
      {
        num: 2,
        title: 'Скачайте и установите проект',
        icon: '📥',
        description: 'Клонируйте репозиторий и запустите установку.',
        commands: [
          { cmd: 'git clone https://github.com/your-username/video2shorts.git', comment: 'Клонирование' },
          { cmd: 'cd video2shorts', comment: 'Переход в папку' },
          { cmd: 'chmod +x install.sh && ./install.sh', comment: 'Запуск установки' },
        ],
        notes: [
          'Скрипт проверит все зависимости',
          'Создаст venv и установит pip-пакеты'
        ]
      },
      {
        num: 3,
        title: 'Запустите Ollama',
        icon: '🧠',
        description: 'Установите Ollama для AI-анализа хайлайтов.',
        commands: [
          { cmd: 'brew install ollama', comment: 'Установка Ollama' },
          { cmd: 'ollama serve &', comment: 'Запуск сервиса' },
          { cmd: 'ollama pull qwen2.5:14b', comment: 'Скачивание модели' },
        ],
        notes: [
          'Можно скачать Ollama с сайта: ollama.com',
          'Без Ollama скрипт работает с fallback-алгоритмом'
        ]
      },
      {
        num: 4,
        title: 'Обработайте видео!',
        icon: '🚀',
        description: 'Положите видео в папку и запустите обработку.',
        commands: [
          { cmd: 'source venv/bin/activate', comment: 'Активация окружения' },
          { cmd: 'python main.py --input ./videos/ --output ./clips/', comment: 'Полная обработка' },
          { cmd: 'python main.py --input video.mp4 --dry-run', comment: 'Или тестовый запуск' },
        ],
        notes: [
          'На Mac с Apple Silicon GPU-ускорение через MPS',
          'В config.yaml укажите device: "cpu" если нет NVIDIA'
        ],
        tip: 'На M1/M2/M3 Mac транскрибация работает быстро даже на CPU!'
      },
    ],
    windows: [
      {
        num: 1,
        title: 'Установите Python и FFmpeg',
        icon: '🐍',
        description: 'Скачайте и установите Python 3.11+ и FFmpeg.',
        commands: [
          { cmd: 'winget install Python.Python.3.11', comment: 'Установка Python через winget' },
          { cmd: 'winget install Gyan.FFmpeg', comment: 'Установка FFmpeg' },
        ],
        notes: [
          'Или скачайте Python с python.org (отметьте "Add to PATH"!)',
          'FFmpeg: скачайте с gyan.dev и добавьте bin/ в PATH',
          'После установки перезапустите терминал'
        ],
        warning: 'Обязательно отметьте "Add Python to PATH" при установке!'
      },
      {
        num: 2,
        title: 'Запустите установку',
        icon: '⚙️',
        description: 'Откройте командную строку (cmd) и запустите install.bat.',
        commands: [
          { cmd: 'cd video2shorts', comment: 'Переход в папку проекта' },
          { cmd: 'install.bat', comment: 'Запуск установки' },
        ],
        notes: [
          'Скрипт создаст venv и установит зависимости',
          'Можно использовать PowerShell или CMD'
        ]
      },
      {
        num: 3,
        title: 'Установите Ollama (опционально)',
        icon: '🧠',
        description: 'Скачайте Ollama для Windows с официального сайта.',
        commands: [
          { cmd: 'winget install Ollama.Ollama', comment: 'Установка Ollama' },
          { cmd: 'ollama pull qwen2.5:14b', comment: 'Скачивание модели' },
        ],
        notes: [
          'Скачайте с: https://ollama.com/download',
          'Ollama запускается автоматически как сервис'
        ]
      },
      {
        num: 4,
        title: 'Обработка видео',
        icon: '🚀',
        description: 'Активируйте окружение и запустите скрипт.',
        commands: [
          { cmd: 'venv\\Scripts\\activate', comment: 'Активация окружения' },
          { cmd: 'python main.py --input .\\videos\\ --output .\\clips\\', comment: 'Обработка видео' },
          { cmd: 'python main.py --input video.mp4 --dry-run', comment: 'Тестовый запуск' },
        ],
        notes: [
          'На Windows пути используют обратный слэш \\',
          'Если есть NVIDIA GPU — ускорение работает автоматически'
        ],
        tip: 'Для GPU нужен драйвер NVIDIA 525+ и CUDA 12+'
      },
    ]
  };

  const currentSteps = steps[os];

  const faqItems = [
    {
      q: 'Нужна ли видеокарта NVIDIA?',
      a: 'Нет, скрипт работает и на CPU. Но с NVIDIA GPU обработка в 5-10 раз быстрее. Если GPU нет — в config.yaml укажите device: "cpu" и compute_type: "int8".'
    },
    {
      q: 'Сколько времени занимает обработка?',
      a: 'Зависит от длины видео и железа. Примерно: 10-минутное видео на GPU — 3-5 минут. На CPU — 15-30 минут. Транскрибация — самый долгий этап.'
    },
    {
      q: 'Можно ли без Ollama (без AI-хайлайтов)?',
      a: 'Да! Без Ollama используется fallback-алгоритм — он ищет хайлайты по эвристикам (вопросы, восклицания, ключевые слова). Работает, но менее точно.'
    },
    {
      q: 'Как изменить количество/длину клипов?',
      a: 'В config.yaml: highlights.count — количество клипов (по умолчанию 5), highlights.min_duration — мин. длина в секундах (30), highlights.max_duration — макс. длина (60).'
    },
    {
      q: 'Как прервать и возобновить обработку?',
      a: 'Нажмите Ctrl+C для прерывания. Промежуточные результаты сохраняются в cache/. Для возобновления: python main.py --input ./videos/ --resume'
    },
    {
      q: 'Субтитры не отображаются в клипах',
      a: 'Проверьте: 1) SRT-файл создан в папке output, 2) Шрифт Arial установлен в системе, 3) В Linux: sudo apt install fonts-liberation. Или укажите другой шрифт в config.yaml.'
    },
    {
      q: 'Ошибка "CUDA out of memory"',
      a: 'Уменьшите модель в config.yaml: transcription.model: "small" или "base". Или переключитесь на CPU: transcription.device: "cpu".'
    },
    {
      q: 'Как обработать только часть видео?',
      a: 'Используйте --dry-run чтобы увидеть хайлайты, затем отредактируйте кэшированный файл cache/*_highlights.json — удалите ненужные фрагменты. Запустите с --resume.'
    },
  ];

  const allCommands = [
    { desc: 'Тестовый запуск', cmd: 'python main.py --input video.mp4 --dry-run' },
    { desc: 'Одно видео', cmd: 'python main.py -i video.mp4 -o ./clips/' },
    { desc: 'Папка с видео', cmd: 'python main.py -i ./videos/ -o ./clips/' },
    { desc: 'Свой конфиг', cmd: 'python main.py -i video.mp4 -c my_config.yaml' },
    { desc: 'Возобновить', cmd: 'python main.py -i ./videos/ --resume' },
    { desc: 'Очистить кэш', cmd: 'python main.py -i ./videos/ --clear-cache' },
    { desc: 'Подробные логи', cmd: 'python main.py -i video.mp4 --log-level DEBUG' },
    { desc: 'Тест транскрибации', cmd: 'python test_transcriber.py -i video.mp4' },
    { desc: 'Тест трекинга', cmd: 'python test_tracker.py -i video.mp4' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg flex items-center justify-center text-sm font-bold">
                V
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                Video2Shorts
              </span>
            </a>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 hidden sm:block">Инструкция по использованию</span>
              <a
                href="/python-project/main.py"
                download
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-pink-600 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                📥 Скачать проект
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-full text-sm text-gray-300 mb-6">
            <span className="text-lg">📖</span> Пошаговое руководство
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Как пользоваться{' '}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              Video2Shorts
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Полная инструкция от установки до получения готовых вертикальных клипов.
            Выберите вашу операционную систему и следуйте шагам.
          </p>
        </div>
      </section>

      {/* OS Selector */}
      <section className="pb-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-sm text-gray-400">Ваша ОС:</span>
          </div>
          <div className="flex justify-center gap-3">
            {([
              { id: 'linux' as OS, label: 'Linux', icon: '🐧' },
              { id: 'mac' as OS, label: 'macOS', icon: '🍎' },
              { id: 'windows' as OS, label: 'Windows', icon: '🪟' },
            ]).map((option) => (
              <button
                key={option.id}
                onClick={() => { setOs(option.id); setActiveStep(0); }}
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                  os === option.id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25 scale-105'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <span className="mr-2">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="pb-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Step navigation */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {currentSteps.map((step, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeStep === i
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/50'
                    : i < activeStep
                    ? 'bg-green-900/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-800/50 text-gray-500 border border-gray-700'
                }`}
              >
                <span>{i < activeStep ? '✅' : step.icon}</span>
                <span className="hidden sm:inline">Шаг {step.num}</span>
              </button>
            ))}
          </div>

          {/* Active step content */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Step header */}
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-b border-gray-800 p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                  {currentSteps[activeStep].icon}
                </div>
                <div>
                  <div className="text-sm text-gray-400">Шаг {currentSteps[activeStep].num} из {currentSteps.length}</div>
                  <h2 className="text-2xl font-bold">{currentSteps[activeStep].title}</h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              <p className="text-gray-300 text-lg leading-relaxed">
                {currentSteps[activeStep].description}
              </p>

              {/* Commands */}
              {currentSteps[activeStep].commands && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Команды</h3>
                  {currentSteps[activeStep].commands!.map((c, i) => (
                    <CommandBlock key={i} cmd={c.cmd} comment={c.comment} />
                  ))}
                </div>
              )}

              {/* Notes */}
              {currentSteps[activeStep].notes && (
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">📝 Примечания</h3>
                  <ul className="space-y-2">
                    {currentSteps[activeStep].notes!.map((note, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="text-gray-600 mt-0.5">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warning */}
              {currentSteps[activeStep].warning && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <p className="text-yellow-200 text-sm">{currentSteps[activeStep].warning}</p>
                  </div>
                </div>
              )}

              {/* Tip */}
              {currentSteps[activeStep].tip && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <p className="text-green-200 text-sm">{currentSteps[activeStep].tip}</p>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <button
                  onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                  disabled={activeStep === 0}
                  className="px-4 py-2 bg-gray-800 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ← Назад
                </button>
                <span className="text-sm text-gray-500">
                  {activeStep + 1} / {currentSteps.length}
                </span>
                <button
                  onClick={() => setActiveStep(Math.min(currentSteps.length - 1, activeStep + 1))}
                  disabled={activeStep === currentSteps.length - 1}
                  className="px-4 py-2 bg-violet-600 rounded-lg text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Далее →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Command Reference */}
      <section className="py-16 bg-gray-900/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                📋 Шпаргалка команд
              </span>
            </h2>
            <p className="text-gray-400">Все команды в одном месте — нажмите, чтобы скопировать</p>
          </div>

          <div className="grid gap-3">
            {allCommands.map((item, i) => (
              <div
                key={i}
                className="group flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-violet-500/30 transition-colors cursor-pointer"
                onClick={() => navigator.clipboard.writeText(item.cmd)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-300 mb-1">{item.desc}</div>
                  <code className="text-xs text-gray-500 font-mono truncate block">{item.cmd}</code>
                </div>
                <div className="text-gray-600 group-hover:text-violet-400 transition-colors shrink-0">
                  📋
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Config Explanation */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">
              <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
                ⚙️ Настройка config.yaml
              </span>
            </h2>
            <p className="text-gray-400">Основные параметры, которые стоит изменить под себя</p>
          </div>

          <div className="space-y-4">
            {[
              {
                param: 'transcription.model',
                values: ['tiny', 'base', 'small', 'medium', 'large-v3'],
                default: 'medium',
                desc: 'Размер модели Whisper. Больше = точнее, но медленнее и больше RAM.',
                tip: 'Для начала попробуйте "small". Если качество плохое — ставьте "medium".'
              },
              {
                param: 'transcription.device',
                values: ['auto', 'cuda', 'cpu'],
                default: 'auto',
                desc: 'Устройство для вычислений. "auto" определит сам.',
                tip: 'Без NVIDIA GPU ставьте "cpu" — будет работать, просто медленнее.'
              },
              {
                param: 'highlights.count',
                values: ['3', '5', '10'],
                default: '5',
                desc: 'Сколько клипов искать в каждом видео.',
                tip: 'Для длинных подкастов (1ч+) ставьте 10. Для коротких — 3.'
              },
              {
                param: 'highlights.min_duration',
                values: ['15', '30', '45'],
                default: '30',
                desc: 'Минимальная длина клипа в секундах.',
                tip: 'Для TikTok ставьте 15-30. Для YouTube Shorts — 30-60.'
              },
              {
                param: 'tracking.smoothing',
                values: ['kalman', 'moving_average'],
                default: 'kalman',
                desc: 'Метод сглаживания координат трекинга.',
                tip: 'Калман даёт более плавное движение. Скользящее среднее — проще и быстрее.'
              },
              {
                param: 'render.crf',
                values: ['18', '23', '28'],
                default: '18',
                desc: 'Качество видео. Меньше = лучше, но больше файл.',
                tip: '18 — отличное качество. 23 — хороший баланс. 28 — экономия места.'
              },
            ].map((item, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <code className="text-violet-300 font-mono text-sm font-semibold">{item.param}</code>
                  <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 shrink-0">
                    по умолчанию: <span className="text-green-400">{item.default}</span>
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-3">{item.desc}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.values.map((v) => (
                    <span
                      key={v}
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        v === item.default
                          ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {v}
                    </span>
                  ))}
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <span>💡</span>
                  <span>{item.tip}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-gray-900/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                ❓ Частые вопросы
              </span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <span className="font-medium text-gray-200 pr-4">{item.q}</span>
                  <span className={`text-gray-500 transition-transform shrink-0 ${expandedFaq === i ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {expandedFaq === i && (
                  <div className="px-5 pb-5 text-gray-400 text-sm leading-relaxed border-t border-gray-800 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Output Structure */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">
              <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                📁 Что получится на выходе
              </span>
            </h2>
            <p className="text-gray-400">Структура файлов после обработки</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <pre className="font-mono text-sm text-gray-300 leading-relaxed overflow-x-auto">
{`clips/                          ← Выходная папка
├── report.json                 ← Итоговый отчёт
├── my_video/                   ← Папка для каждого видео
│   ├── my_video_transcript.json  ← Транскрипт с таймкодами
│   ├── my_video.srt              ← Субтитры (SRT)
│   ├── clip_01_120s-165s.mp4     ← Готовый клип #1
│   ├── clip_02_340s-395s.mp4     ← Готовый клип #2
│   ├── clip_03_580s-630s.mp4     ← Готовый клип #3
│   └── test_clips/               ← Превью (первые 5 сек)
│       ├── test_clip_01_...mp4
│       └── test_clip_02_...mp4
└── another_video/
    └── ...

cache/                          ← Кэш для возобновления
├── pipeline_state.json
├── abc123_transcript.json
├── abc123_highlights.json
└── abc123_tracking.json`}
            </pre>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">📱</div>
              <div className="text-sm font-medium text-gray-300">clip_XX_*.mp4</div>
              <div className="text-xs text-gray-500 mt-1">Готовые вертикальные клипы 1080×1920</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">📝</div>
              <div className="text-sm font-medium text-gray-300">*.srt</div>
              <div className="text-xs text-gray-500 mt-1">Субтитры с таймкодами</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-sm font-medium text-gray-300">report.json</div>
              <div className="text-xs text-gray-500 mt-1">Отчёт: что и когда обработано</div>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section className="py-16 bg-gray-900/30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              📦 Скачать все файлы проекта
            </span>
          </h2>
          <p className="text-gray-400 mb-8">
            Все Python-файлы готовы к использованию. Скачайте и распакуйте в любую папку.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
            {[
              { name: 'main.py', icon: '🎬', desc: 'Оркестратор пайплайна' },
              { name: 'transcriber.py', icon: '🎙️', desc: 'Транскрибация (Whisper)' },
              { name: 'highlight_finder.py', icon: '🧠', desc: 'Поиск хайлайтов (LLM)' },
              { name: 'face_tracker.py', icon: '👤', desc: 'Трекинг лица (YOLOv8)' },
              { name: 'video_renderer.py', icon: '🎞️', desc: 'Рендеринг (FFmpeg)' },
              { name: 'config.yaml', icon: '⚙️', desc: 'Конфигурация' },
              { name: 'requirements.txt', icon: '📋', desc: 'Python-зависимости' },
              { name: 'install.sh', icon: '🐧', desc: 'Установка (Linux/Mac)' },
              { name: 'install.bat', icon: '🪟', desc: 'Установка (Windows)' },
              { name: 'test_transcriber.py', icon: '🧪', desc: 'Тест транскрибации' },
              { name: 'test_tracker.py', icon: '🧪', desc: 'Тест трекинга' },
              { name: 'README.md', icon: '📖', desc: 'Документация' },
            ].map((file, i) => (
              <a
                key={i}
                href={`/python-project/${file.name}`}
                download
                className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-violet-500/30 hover:bg-gray-800/50 transition-all group"
              >
                <span className="text-2xl">{file.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">{file.name}</div>
                  <div className="text-xs text-gray-500">{file.desc}</div>
                </div>
                <span className="text-gray-600 group-hover:text-violet-400 transition-colors">⬇️</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start Summary */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-br from-violet-900/30 to-pink-900/30 border border-violet-500/20 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">⚡ Самый быстрый старт</h2>
            <p className="text-gray-400 mb-6">Если всё уже установлено — просто выполните:</p>
            <div className="bg-gray-950 rounded-xl p-4 font-mono text-sm text-left max-w-lg mx-auto mb-6">
              <div className="text-green-400">$ python main.py --input ваше_видео.mp4 --output ./clips/</div>
            </div>
            <p className="text-gray-500 text-sm">
              Через несколько минут в папке <code className="text-violet-300">clips/</code> появятся готовые вертикальные ролики 🎉
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Video2Shorts — AI-powered video converter • MIT License</p>
          <p className="mt-1">Без водяных знаков • Без лимитов • Полностью бесплатно</p>
        </div>
      </footer>
    </div>
  );
}
