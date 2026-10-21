import { useState } from 'react';
import { 
  Film, Code, Terminal, Settings, BookOpen, 
  Copy, Check, ChevronDown, ChevronRight,
  Cpu, Mic, Brain, Clapperboard, Zap
} from 'lucide-react';
import { CodeBlock } from './components/CodeBlock';
import { 
  mainPy, transcriberPy, highlightFinderPy, faceTrackerPy, 
  videoRendererPy, configYaml, installSh, installBat,
  requirementsTxt, testTranscriberPy, testTrackerPy, readmeMd
} from './data/pythonCode';

type TabId = 'overview' | 'code' | 'install' | 'config';

interface FileItem {
  name: string;
  language: string;
  code: string;
  description: string;
}

const files: FileItem[] = [
  { name: 'main.py', language: 'python', code: mainPy, description: 'Оркестратор пайплайна' },
  { name: 'transcriber.py', language: 'python', code: transcriberPy, description: 'Транскрибация через faster-whisper' },
  { name: 'highlight_finder.py', language: 'python', code: highlightFinderPy, description: 'Поиск хайлайтов через LLM' },
  { name: 'face_tracker.py', language: 'python', code: faceTrackerPy, description: 'Трекинг лица через YOLOv8' },
  { name: 'video_renderer.py', language: 'python', code: videoRendererPy, description: 'Рендер через FFmpeg' },
  { name: 'config.yaml', language: 'yaml', code: configYaml, description: 'Конфигурация проекта' },
  { name: 'requirements.txt', language: 'text', code: requirementsTxt, description: 'Python зависимости' },
  { name: 'install.sh', language: 'bash', code: installSh, description: 'Установщик для Linux/Mac' },
  { name: 'install.bat', language: 'batch', code: installBat, description: 'Установщик для Windows' },
  { name: 'test_transcriber.py', language: 'python', code: testTranscriberPy, description: 'Тест транскрибации' },
  { name: 'test_tracker.py', language: 'python', code: testTrackerPy, description: 'Тест трекинга' },
  { name: 'README.md', language: 'markdown', code: readmeMd, description: 'Документация проекта' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(['main.py']));

  const toggleFile = (name: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                Video2Shorts
              </h1>
              <p className="text-xs text-gray-400">AI-powered video converter</p>
            </div>
          </div>
          <nav className="flex gap-1">
            {([
              ['overview', 'Обзор', BookOpen],
              ['code', 'Код', Code],
              ['install', 'Установка', Terminal],
              ['config', 'Конфиг', Settings],
            ] as [TabId, string, typeof BookOpen][]).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === id 
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && <OverviewSection />}
        {activeTab === 'code' && (
          <CodeSection 
            files={files} 
            expandedFiles={expandedFiles} 
            toggleFile={toggleFile} 
          />
        )}
        {activeTab === 'install' && <InstallSection />}
        {activeTab === 'config' && <ConfigSection />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 text-center text-gray-500 text-sm">
        <p>Video2Shorts — Конвертация длинных видео в короткие вертикальные ролики</p>
        <p className="mt-1">Python • faster-whisper • YOLOv8 • FFmpeg • Ollama</p>
      </footer>
    </div>
  );
}

function OverviewSection() {
  const features = [
    {
      icon: Mic,
      title: 'Транскрибация',
      description: 'faster-whisper с поддержкой русского языка, генерация .srt и .json с пословными таймкодами',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Brain,
      title: 'AI-хайлайты',
      description: 'Поиск вирусных фрагментов через LLM (Ollama + qwen2.5/llama3) с анализом хуков и эмоций',
      color: 'from-violet-500 to-purple-500'
    },
    {
      icon: Cpu,
      title: 'Трекинг лица',
      description: 'YOLOv8 детекция + фильтр Калмана для плавного динамического кропа без дрожания',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Clapperboard,
      title: 'Рендер',
      description: 'FFmpeg filter_complex с динамическим кропом 9:16, burn-in субтитрами и кастомным стилем',
      color: 'from-orange-500 to-red-500'
    },
  ];

  const pipeline = [
    { step: '1', title: 'Транскрибация', desc: 'Аудио → Текст с таймкодами' },
    { step: '2', title: 'Поиск хайлайтов', desc: 'LLM находит лучшие фрагменты' },
    { step: '3', title: 'Трекинг', desc: 'YOLOv8 + Калман для кропа' },
    { step: '4', title: 'Рендер', desc: 'FFmpeg → 1080x1920 видео' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-300">
          <Zap className="w-4 h-4" />
          <span>Полностью автоматический пайплайн</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold">
          <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
            Длинные видео → Короткие ролики
          </span>
        </h2>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Автоматическая конвертация горизонтальных видео в вертикальные 9:16 для TikTok, 
          Instagram Reels и VK Клипов с помощью AI
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <code className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-green-400">
            python main.py --input ./videos/ --output ./clips/
          </code>
        </div>
      </div>

      {/* Pipeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h3 className="text-2xl font-bold text-center mb-8">Пайплайн обработки</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {pipeline.map((item, i) => (
            <div key={i} className="relative">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                  {item.step}
                </div>
                <h4 className="font-semibold text-white">{item.title}</h4>
                <p className="text-sm text-gray-400 mt-1">{item.desc}</p>
              </div>
              {i < pipeline.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 text-violet-500">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
            <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
              <feature.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-gray-400">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Tech Stack */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h3 className="text-2xl font-bold text-center mb-6">Технологии</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            'Python 3.10+', 'faster-whisper', 'YOLOv8', 'FFmpeg', 
            'Ollama', 'OpenCV', 'Kalman Filter', 'H.264',
            'CUDA', 'tqdm', 'PyYAML', 'MediaPipe'
          ].map(tech => (
            <span key={tech} className="bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 text-sm text-gray-300">
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Output specs */}
      <div className="bg-gradient-to-r from-violet-900/20 to-pink-900/20 border border-violet-800/30 rounded-2xl p-8">
        <h3 className="text-2xl font-bold text-center mb-6">Параметры выходного видео</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-violet-400">1080×1920</div>
            <div className="text-sm text-gray-400 mt-1">Разрешение</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-pink-400">30 FPS</div>
            <div className="text-sm text-gray-400 mt-1">Частота кадров</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-400">H.264</div>
            <div className="text-sm text-gray-400 mt-1">Кодек</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-400">AAC</div>
            <div className="text-sm text-gray-400 mt-1">Аудио</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeSection({ files, expandedFiles, toggleFile }: { 
  files: FileItem[]; 
  expandedFiles: Set<string>; 
  toggleFile: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Исходный код проекта</h2>
        <span className="text-sm text-gray-400">{files.length} файлов</span>
      </div>

      {files.map(file => (
        <div key={file.name} className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900">
          <button
            onClick={() => toggleFile(file.name)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedFiles.has(file.name) 
                ? <ChevronDown className="w-5 h-5 text-violet-400" />
                : <ChevronRight className="w-5 h-5 text-gray-500" />
              }
              <Code className="w-5 h-5 text-gray-400" />
              <div className="text-left">
                <span className="font-mono font-semibold text-white">{file.name}</span>
                <span className="text-sm text-gray-400 ml-3">{file.description}</span>
              </div>
            </div>
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
              {file.language}
            </span>
          </button>
          
          {expandedFiles.has(file.name) && (
            <div className="border-t border-gray-800">
              <CodeBlock code={file.code} language={file.language} filename={file.name} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InstallSection() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Установка и запуск</h2>

      {/* Requirements */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-violet-400" />
          Системные требования
        </h3>
        <ul className="space-y-2 text-gray-300">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Python 3.10+
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            FFmpeg (в PATH)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            NVIDIA GPU (опционально, для ускорения)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Ollama (для локальной LLM)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            8GB+ RAM (16GB рекомендуется)
          </li>
        </ul>
      </div>

      {/* Quick Install */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">⚡ Быстрая установка</h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-2">Linux / macOS:</p>
            <CodeBlock code={`chmod +x install.sh\n./install.sh`} language="bash" filename="terminal" />
          </div>
          
          <div>
            <p className="text-sm text-gray-400 mb-2">Windows:</p>
            <CodeBlock code={`install.bat`} language="batch" filename="cmd" />
          </div>
        </div>
      </div>

      {/* Manual Install */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">🔧 Ручная установка</h3>
        <CodeBlock 
          code={`# 1. Создать виртуальное окружение
python -m venv venv

# 2. Активировать (Linux/Mac)
source venv/bin/activate
# или (Windows)
venv\\Scripts\\activate

# 3. Установить зависимости
pip install -r requirements.txt

# 4. Скачать модели
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
python -c "from faster_whisper import WhisperModel; WhisperModel('medium')"

# 5. Установить Ollama и модель
# Скачать: https://ollama.ai
ollama pull qwen2.5`}
          language="bash" 
          filename="terminal" 
        />
      </div>

      {/* Usage */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">🎯 Использование</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-2">Обработка папки с видео:</p>
            <CodeBlock code={`python main.py --input ./videos/ --output ./clips/`} language="bash" filename="terminal" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Обработка одного видео:</p>
            <CodeBlock code={`python main.py --input my_video.mp4 --output ./clips/`} language="bash" filename="terminal" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Dry-run (без рендера, только анализ):</p>
            <CodeBlock code={`python main.py --input ./videos/ --output ./clips/ --dry-run`} language="bash" filename="terminal" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">С кастомным конфигом:</p>
            <CodeBlock code={`python main.py --input ./videos/ --output ./clips/ --config my_config.yaml`} language="bash" filename="terminal" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Тест отдельных модулей:</p>
            <CodeBlock code={`python test_transcriber.py --input video.mp4\npython test_tracker.py --input video.mp4`} language="bash" filename="terminal" />
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">❓ Troubleshooting</h3>
        <div className="space-y-4">
          <div className="border-l-2 border-red-500 pl-4">
            <p className="font-semibold text-red-400">FFmpeg не найден</p>
            <CodeBlock code={`# Ubuntu/Debian\nsudo apt install ffmpeg\n\n# macOS\nbrew install ffmpeg\n\n# Windows: скачать с https://ffmpeg.org/download.html`} language="bash" filename="terminal" />
          </div>
          <div className="border-l-2 border-yellow-500 pl-4">
            <p className="font-semibold text-yellow-400">Ollama не отвечает</p>
            <CodeBlock code={`ollama serve\ncurl http://localhost:11434/api/tags`} language="bash" filename="terminal" />
          </div>
          <div className="border-l-2 border-orange-500 pl-4">
            <p className="font-semibold text-orange-400">Out of Memory</p>
            <p className="text-sm text-gray-400 mt-1">
              Используйте модель <code className="bg-gray-800 px-1 rounded">small</code> вместо <code className="bg-gray-800 px-1 rounded">medium</code>, 
              уменьшите <code className="bg-gray-800 px-1 rounded">split_duration_minutes</code> в конфиге
            </p>
          </div>
          <div className="border-l-2 border-blue-500 pl-4">
            <p className="font-semibold text-blue-400">CUDA не обнаружена</p>
            <CodeBlock code={`pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`} language="bash" filename="terminal" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigSection() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Конфигурация</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">config.yaml</h3>
        <CodeBlock code={configYaml} language="yaml" filename="config.yaml" />
      </div>

      {/* Config table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 overflow-x-auto">
        <h3 className="text-lg font-semibold mb-4">Описание параметров</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Параметр</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">По умолчанию</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Описание</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[
              ['whisper_model', 'medium', 'Модель Whisper (tiny/base/small/medium/large-v3)'],
              ['whisper_language', 'ru', 'Код языка транскрибации'],
              ['whisper_device', 'auto', 'Устройство (auto/cuda/cpu)'],
              ['llm_provider', 'ollama', 'Провайдер LLM (ollama/openai)'],
              ['llm_model', 'qwen2.5', 'Модель LLM'],
              ['llm_base_url', 'http://localhost:11434', 'URL API LLM'],
              ['yolo_model', 'yolov8n.pt', 'Модель YOLO для трекинга'],
              ['yolo_confidence', '0.5', 'Порог уверенности детекции'],
              ['smoothing_window', '15', 'Окно сглаживания координат'],
              ['output_resolution', '[1080, 1920]', 'Выходное разрешение (9:16)'],
              ['output_fps', '30', 'Частота кадров'],
              ['max_highlights', '5', 'Макс. количество клипов'],
              ['highlight_min_duration', '30', 'Мин. длительность клипа (сек)'],
              ['highlight_max_duration', '60', 'Макс. длительность клипа (сек)'],
              ['subtitle_font_size', '48', 'Размер шрифта субтитров'],
              ['split_duration_minutes', '5', 'Длительность частей при разбиении'],
            ].map(([param, defVal, desc]) => (
              <tr key={param} className="hover:bg-gray-800/50">
                <td className="py-3 px-4 font-mono text-violet-400">{param}</td>
                <td className="py-3 px-4 font-mono text-green-400">{defVal}</td>
                <td className="py-3 px-4 text-gray-300">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
