import { useState } from 'react';

// Все файлы проекта с прямыми ссылками для скачивания
const projectFiles = [
  {
    name: 'main.py',
    url: '/python-project/main.py',
    desc: 'Главный скрипт — запускает весь процесс конвертации',
    required: true,
  },
  {
    name: 'transcriber.py',
    url: '/python-project/transcriber.py',
    desc: 'Транскрибация аудио через faster-whisper',
    required: true,
  },
  {
    name: 'highlight_finder.py',
    url: '/python-project/highlight_finder.py',
    desc: 'Поиск вирусных фрагментов через локальную LLM',
    required: true,
  },
  {
    name: 'face_tracker.py',
    url: '/python-project/face_tracker.py',
    desc: 'Трекинг лица через YOLOv8 + фильтр Калмана',
    required: true,
  },
  {
    name: 'video_renderer.py',
    url: '/python-project/video_renderer.py',
    desc: 'Рендеринг вертикальных клипов через FFmpeg',
    required: true,
  },
  {
    name: 'config.yaml',
    url: '/python-project/config.yaml',
    desc: 'Настройки — размер модели, количество клипов и т.д.',
    required: true,
  },
  {
    name: 'requirements.txt',
    url: '/python-project/requirements.txt',
    desc: 'Список Python-библиотек для установки',
    required: true,
  },
  {
    name: 'install.sh',
    url: '/python-project/install.sh',
    desc: 'Скрипт установки для Linux и macOS',
    required: false,
    platform: 'Mac/Linux',
  },
  {
    name: 'install.bat',
    url: '/python-project/install.bat',
    desc: 'Скрипт установки для Windows',
    required: false,
    platform: 'Windows',
  },
  {
    name: 'test_transcriber.py',
    url: '/python-project/test_transcriber.py',
    desc: 'Тестовый скрипт для проверки транскрибации',
    required: false,
  },
  {
    name: 'test_tracker.py',
    url: '/python-project/test_tracker.py',
    desc: 'Тестовый скрипт для проверки трекинга',
    required: false,
  },
  {
    name: 'README.md',
    url: '/python-project/README.md',
    desc: 'Документация проекта',
    required: false,
  },
];

export default function App() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (file: { name: string; url: string }) => {
    setDownloading(file.name);
    // Создаём ссылку и кликаем по ней
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(null), 1500);
  };

  const downloadAll = () => {
    // Скачиваем все файлы по очереди с небольшой задержкой
    projectFiles.forEach((file, i) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, i * 300);
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-lg">
                V
              </div>
              <div>
                <h1 className="font-bold text-lg">Video2Shorts</h1>
                <p className="text-xs text-gray-400">Файлы проекта для скачивания</p>
              </div>
            </div>
            <button
              onClick={downloadAll}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-pink-600 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              ⬇️ Скачать всё ({projectFiles.length} файлов)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Инструкция */}
        <div className="bg-gradient-to-br from-violet-900/20 to-pink-900/20 border border-violet-500/30 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            📍 Где находятся файлы?
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Все файлы проекта <strong>уже созданы и лежат на этом сайте</strong>. 
            Просто нажмите кнопку <strong>"Скачать"</strong> рядом с каждым файлом — 
            он сохранится в вашу папку <strong>"Загрузки"</strong>.
          </p>
          <div className="bg-gray-950 rounded-lg p-4 text-sm space-y-2">
            <div className="text-gray-400">📂 Что делать дальше:</div>
            <ol className="space-y-1 text-gray-300 list-decimal list-inside">
              <li>Нажмите <strong>"Скачать всё"</strong> выше — скачаются все 12 файлов</li>
              <li>Создайте папку <code className="text-violet-300">video2shorts</code> на Рабочем столе</li>
              <li>Переместите все скачанные файлы в эту папку</li>
              <li>Откройте терминал в этой папке и запустите <code className="text-green-400">install.bat</code> (Windows) или <code className="text-green-400">./install.sh</code> (Mac/Linux)</li>
              <li>Запустите: <code className="text-green-400">python main.py --input ваше_видео.mp4</code></li>
            </ol>
          </div>
        </div>

        {/* Список файлов */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="bg-gray-800/50 border-b border-gray-800 px-6 py-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              📦 Все файлы проекта
              <span className="text-sm font-normal text-gray-400">({projectFiles.length} шт.)</span>
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Нажмите на файл, чтобы скачать. Или используйте кнопку "Скачать всё" выше.
            </p>
          </div>

          <div className="divide-y divide-gray-800">
            {projectFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors"
              >
                {/* Иконка */}
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-lg shrink-0">
                  {file.name.endsWith('.py') ? '🐍' :
                   file.name.endsWith('.yaml') ? '⚙️' :
                   file.name.endsWith('.txt') ? '📋' :
                   file.name.endsWith('.sh') || file.name.endsWith('.bat') ? '⚡' :
                   '📄'}
                </div>

                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium text-gray-200">
                      {file.name}
                    </span>
                    {file.required && (
                      <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-500/30">
                        обязательно
                      </span>
                    )}
                    {file.platform && (
                      <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                        {file.platform}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{file.desc}</div>
                </div>

                {/* Кнопка скачивания */}
                <button
                  onClick={() => handleDownload(file)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                    downloading === file.name
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 hover:bg-violet-600 text-gray-300 hover:text-white'
                  }`}
                >
                  {downloading === file.name ? '✓ Скачан' : '⬇️ Скачать'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Обязательные vs опциональные */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="text-green-400">✅</span> Обязательно скачать (7 файлов)
            </h3>
            <ul className="space-y-1 text-sm text-gray-400 font-mono">
              <li>• main.py</li>
              <li>• transcriber.py</li>
              <li>• highlight_finder.py</li>
              <li>• face_tracker.py</li>
              <li>• video_renderer.py</li>
              <li>• config.yaml</li>
              <li>• requirements.txt</li>
            </ul>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="text-blue-400">🔧</span> Опционально (5 файлов)
            </h3>
            <ul className="space-y-1 text-sm text-gray-400 font-mono">
              <li>• install.sh <span className="text-gray-600">(Mac/Linux)</span></li>
              <li>• install.bat <span className="text-gray-600">(Windows)</span></li>
              <li>• test_transcriber.py</li>
              <li>• test_tracker.py</li>
              <li>• README.md</li>
            </ul>
          </div>
        </div>

        {/* Куда скачаются */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            📂 Куда скачаются файлы?
          </h2>
          <div className="space-y-3 text-sm text-gray-400">
            <p>
              По умолчанию браузер сохраняет файлы в папку <strong className="text-gray-200">"Загрузки"</strong> (Downloads).
            </p>
            <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs space-y-2">
              <div>
                <span className="text-gray-500">🪟 Windows:</span>{' '}
                <span className="text-gray-300">C:\Users\ВашеИмя\Downloads\</span>
              </div>
              <div>
                <span className="text-gray-500">🍎 Mac:</span>{' '}
                <span className="text-gray-300">/Users/ВашеИмя/Downloads/</span>
              </div>
              <div>
                <span className="text-gray-500">🐧 Linux:</span>{' '}
                <span className="text-gray-300">/home/ВашеИмя/Downloads/</span>
              </div>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-yellow-200">
              💡 <strong>Совет:</strong> После скачивания создайте папку <code>video2shorts</code> на Рабочем столе и переместите туда все файлы.
            </div>
          </div>
        </div>

        {/* Быстрый старт */}
        <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/20 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            🚀 Что делать после скачивания
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">1</div>
              <div className="text-sm text-gray-300">
                Скачайте все файлы и положите в одну папку
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">2</div>
              <div className="text-sm text-gray-300">
                Установите Python с <a href="https://python.org" target="_blank" className="text-violet-400 underline">python.org</a> (отметьте "Add to PATH") и FFmpeg
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">3</div>
              <div className="text-sm text-gray-300">
                Откройте терминал в папке с файлами и запустите установку:
                <div className="mt-2 bg-gray-950 rounded p-2 font-mono text-xs">
                  <div className="text-green-400">install.bat</div>
                  <div className="text-gray-500 mt-1"># или для Mac/Linux: chmod +x install.sh && ./install.sh</div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">4</div>
              <div className="text-sm text-gray-300">
                Запустите обработку видео:
                <div className="mt-2 bg-gray-950 rounded p-2 font-mono text-xs">
                  <div className="text-green-400">python main.py --input ваше_видео.mp4 --output ./clips/</div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">5</div>
              <div className="text-sm text-gray-300">
                Готово! Вертикальные клипы появятся в папке <code className="text-violet-300">clips/</code> 🎉
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-6 border-t border-gray-800">
          <p>Все 12 файлов проекта доступны для скачивания выше</p>
          <p className="mt-1">Нажмите "Скачать всё" — и они попадут в вашу папку "Загрузки"</p>
        </div>
      </div>
    </div>
  );
}
