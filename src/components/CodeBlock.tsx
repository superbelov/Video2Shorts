import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div className="relative group">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-gray-800/80 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/70"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/70"></div>
          </div>
          <span className="text-xs text-gray-400 font-mono ml-2">
            {filename || language}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Скопировано</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="max-h-[600px] overflow-auto bg-[#1e1e2e]">
        <pre className="p-4 text-sm leading-relaxed">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-white/5 -mx-4 px-4">
                <span className="select-none text-gray-600 w-10 text-right mr-4 flex-shrink-0 text-xs leading-relaxed">
                  {i + 1}
                </span>
                <span className="text-gray-200 flex-1">
                  <HighlightedLine line={line} language={language} />
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

function HighlightedLine({ line, language }: { line: string; language: string }) {
  if (language === 'python') {
    return <PythonHighlight line={line} />;
  }
  if (language === 'yaml') {
    return <YamlHighlight line={line} />;
  }
  if (language === 'bash' || language === 'batch') {
    return <BashHighlight line={line} />;
  }
  if (language === 'markdown') {
    return <MarkdownHighlight line={line} />;
  }
  return <span>{line}</span>;
}

function PythonHighlight({ line }: { line: string }) {
  // Simple Python syntax highlighting
  const trimmed = line.trimStart();
  
  // Comments
  if (trimmed.startsWith('#')) {
    return <span className="text-gray-500 italic">{line}</span>;
  }
  
  // Docstrings (simple detection)
  if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
    return <span className="text-green-600">{line}</span>;
  }

  // Keywords
  const keywords = ['import', 'from', 'class', 'def', 'return', 'if', 'else', 'elif', 
    'for', 'while', 'try', 'except', 'with', 'as', 'raise', 'pass', 'break', 'continue',
    'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'self', 'lambda', 'yield',
    'async', 'await'];
  
  const parts: JSX.Element[] = [];
  let remaining = line;
  let key = 0;

  // Process string literals, comments, and keywords
  const regex = /(#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"[^"]*"|'[^']*'|\b(?:import|from|class|def|return|if|else|elif|for|while|try|except|with|as|raise|pass|break|continue|and|or|not|in|is|None|True|False|self|lambda|yield|async|await)\b)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(line)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{line.slice(lastIndex, match.index)}</span>);
    }
    
    const matched = match[0];
    
    if (matched.startsWith('#')) {
      parts.push(<span key={key++} className="text-gray-500 italic">{matched}</span>);
    } else if (matched.startsWith('"""') || matched.startsWith("'''")) {
      parts.push(<span key={key++} className="text-green-600">{matched}</span>);
    } else if (matched.startsWith('"') || matched.startsWith("'")) {
      parts.push(<span key={key++} className="text-amber-400">{matched}</span>);
    } else if (keywords.includes(matched)) {
      parts.push(<span key={key++} className="text-violet-400 font-medium">{matched}</span>);
    }
    
    lastIndex = match.index + matched.length;
  }
  
  // Remaining text
  if (lastIndex < line.length) {
    parts.push(<span key={key++}>{line.slice(lastIndex)}</span>);
  }
  
  if (parts.length === 0) {
    return <span>{line}</span>;
  }
  
  return <>{parts}</>;
}

function YamlHighlight({ line }: { line: string }) {
  if (line.trim().startsWith('#')) {
    return <span className="text-gray-500 italic">{line}</span>;
  }
  
  const colonIndex = line.indexOf(':');
  if (colonIndex > 0) {
    const key = line.slice(0, colonIndex);
    const value = line.slice(colonIndex);
    return (
      <>
        <span className="text-cyan-400">{key}</span>
        <span className="text-gray-400">:</span>
        <span className="text-amber-400">{value.slice(1)}</span>
      </>
    );
  }
  
  return <span>{line}</span>;
}

function BashHighlight({ line }: { line: string }) {
  if (line.trim().startsWith('#') || line.trim().startsWith('REM') || line.trim().startsWith('@echo')) {
    return <span className="text-gray-500">{line}</span>;
  }
  
  // Highlight commands
  const commands = ['pip', 'python', 'source', 'chmod', 'echo', 'mkdir', 'curl', 'ollama', 'sudo', 'apt', 'brew', 'python3', 'ffmpeg', 'set'];
  
  for (const cmd of commands) {
    if (line.trim().startsWith(cmd)) {
      return (
        <>
          <span className="text-green-400 font-medium">{cmd}</span>
          <span className="text-gray-300">{line.slice(line.indexOf(cmd) + cmd.length)}</span>
        </>
      );
    }
  }
  
  return <span className="text-gray-200">{line}</span>;
}

function MarkdownHighlight({ line }: { line: string }) {
  if (line.startsWith('# ')) {
    return <span className="text-violet-400 font-bold text-lg">{line}</span>;
  }
  if (line.startsWith('## ')) {
    return <span className="text-violet-400 font-bold">{line}</span>;
  }
  if (line.startsWith('### ')) {
    return <span className="text-violet-300 font-semibold">{line}</span>;
  }
  if (line.startsWith('```')) {
    return <span className="text-gray-500">{line}</span>;
  }
  if (line.startsWith('- ') || line.startsWith('* ')) {
    return (
      <>
        <span className="text-violet-400">{line.slice(0, 2)}</span>
        <span className="text-gray-200">{line.slice(2)}</span>
      </>
    );
  }
  return <span className="text-gray-300">{line}</span>;
}
