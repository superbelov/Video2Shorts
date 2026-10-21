import { useState } from 'react';

const files = [
  { name: 'main.py', url: '/python-project/main.py', icon: '🐍', desc: 'Главный скрипт' },
  { name: 'transcriber.py', url: '/python-project/transcriber.py', icon: '🐍', desc: 'Транскрибация' },
  { name: 'highlight_finder.py', url: '/python-project/highlight_finder.py', icon: '🐍', desc: 'Поиск хайлайтов' },
  { name: 'face_tracker.py', url: '/python-project/face_tracker.py', icon: '🐍', desc: 'Трекинг лица' },
  { name: 'video_renderer.py', url: '/python-project/video_renderer.py', icon: '🐍', desc: 'Рендеринг видео' },
  { name: 'config.yaml', url: '/python-project/config.yaml', icon: '⚙️', desc: 'Настройки' },
  { name: 'requirements.txt', url: '/python-project/requirements.txt', icon: '📋', desc: 'Список библиотек' },
  { name: 'install.bat', url: '/python-project/install.bat', icon: '⚡', desc: 'Установка Windows' },
  { name: 'install.sh', url: '/python-project/install.sh', icon: '⚡', desc: 'Установка Mac/Linux' },
  { name: 'test_transcriber.py', url: '/python-project/test_transcriber.py', icon: '🧪', desc: 'Тест транскрибации' },
  { name: 'test_tracker.py', url: '/python-project/test_tracker.py', icon: '🧪', desc: 'Тест трекинга' },
  { name: 'README.md', url: '/python-project/README.md', icon: '📖', desc: 'Документация' },
];

export default function App() {
  const [downloaded, setDownloaded] = useState<string[]>([]);

  const download = (name: string, url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (!downloaded.includes(name)) {
      setDownloaded([...downloaded, name]);
    }
  };

  const downloadAll = () => {
    files.forEach((f, i) => {
      setTimeout(() => download(f.name, f.url), i * 400);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Заголовок */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-3xl font-bold mb-3">
            Файлы проекта Video2Shorts
          </h1>
          <p className="text-gray-400">
            Нажмите на кнопку <strong className="text-white">"Скачать"</strong> — файл попадёт на ваш ноутбук
          </p>
        </div>

        {/* Большая кнопка "Скачать всё" */}
        <button
          onClick={downloadAll}
          className="w-full mb-8 py-5 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-2xl text-xl font-bold shadow-2xl shadow-violet-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          ⬇️ Скачать все 12 файлов сразу
        </button>

        {/* Или по одному */}
        <div className="text-center text-sm text-gray-500 mb-4">
          или скачайте по одному ↓
        </div>

        {/* Список файлов */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
          {files.map((file, i) => (
            <div
              key={file.name}
              className={`flex items-center gap-3 p-4 ${
                i !== files.length - 1 ? 'border-b border-gray-800' : ''
              } hover:bg-gray-800/30 transition-colors`}
            >
              <div className="text-2xl w-10 text-center shrink-0">{file.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-medium text-gray-200 truncate">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500">{file.desc}</div>
              </div>
              <button
                onClick={() => download(file.name, file.url)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                  downloaded.includes(file.name)
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-800 hover:bg-violet-600 text-gray-300 hover:text-white'
                }`}
              >
                {downloaded.includes(file.name) ? '✓ Скачан' : '⬇️ Скачать'}
              </button>
            </div>
          ))}
        </div>

        {/* Куда попадают файлы */}
        <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-2xl p-5">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            📂 Куда попадают файлы?
          </h2>
          <p className="text-gray-300 text-sm mb-3">
            Файлы скачаются в папку <strong className="text-white">"Загрузки"</strong> (Downloads) на вашем ноутбуке.
          </p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs space-y-1">
            <div><span className="text-gray-500">Windows:</span> <span className="text-gray-300">C:\Users\ВашеИмя\Downloads\</span></div>
            <div><span className="text-gray-500">Mac:</span> <span className="text-gray-300">/Users/ВашеИмя/Downloads/</span></div>
            <div><span className="text-gray-500">Linux:</span> <span className="text-gray-300">/home/ВашеИмя/Downloads/</span></div>
          </div>
        </div>

        {/* Что делать дальше */}
        <div className="mt-6 bg-green-900/20 border border-green-500/30 rounded-2xl p-5">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            ✅ Что делать после скачивания
          </h2>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">1.</span>
              <span>Найдите скачанные файлы в папке <strong className="text-white">"Загрузки"</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">2.</span>
              <span>Создайте папку <code className="bg-gray-950 px-2 py-0.5 rounded text-violet-300">video2shorts</code> на Рабочем столе</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">3.</span>
              <span>Переместите все 12 файлов в эту папку</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">4.</span>
              <span>Установите Python с <a href="https://python.org" target="_blank" className="text-violet-400 underline">python.org</a> и FFmpeg</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">5.</span>
              <span>Откройте терминал в папке и запустите <code className="bg-gray-950 px-2 py-0.5 rounded text-green-300">install.bat</code></span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">6.</span>
              <span>Запустите: <code className="bg-gray-950 px-2 py-0.5 rounded text-green-300">python main.py --input видео.mp4</code></span>
            </li>
          </ol>
        </div>

        {/* Подсказка */}
        <div className="mt-6 text-center text-sm text-gray-500">
          💡 Эта страница — и есть тот "сайт", где лежат файлы. Просто нажимайте кнопки "Скачать".
        </div>
      </div>
    </div>
  );
}
