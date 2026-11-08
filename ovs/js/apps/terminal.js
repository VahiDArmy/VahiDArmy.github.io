// AURORA OS — Terminal

import { h, $, clear, fmtTime, fmtDate } from '../core/dom.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'terminal',
  title: 'Terminal',
  icon: '›_',
  defaultSize: { width: 720, height: 460 },
};

let _root = null;
let _output = null;
let _input = null;
let _history = [];
let _historyIdx = -1;
let _cwd = '~';

const COMMANDS = {
  help: {
    desc: 'List available commands',
    run() {
      const lines = ['Available commands:'];
      for (const [name, cmd] of Object.entries(COMMANDS)) {
        lines.push('  ' + name.padEnd(12) + cmd.desc);
      }
      return lines;
    },
  },
  clear: { desc: 'Clear terminal', run() { clear(_output); return []; } },
  echo: { desc: 'Echo input', run(args) { return [args.join(' ')]; } },
  date: { desc: 'Show current date/time', run() { return [new Date().toString()]; } },
  whoami: { desc: 'Show current user', run() { return [store.get('user.name') || 'explorer']; } },
  pwd: { desc: 'Print working directory', run() { return [_cwd]; } },
  ls: {
    desc: 'List directory contents',
    run() { return ['.', '..', 'Documents/', 'Projects/', 'notes.md', 'README.md', 'app.js']; },
  },
  cat: { desc: 'Read a file (mock)', run(args) { return args.length ? ['# ' + args[0] + '\n(mock content)'] : ['usage: cat <file>']; } },
  cd: {
    desc: 'Change directory (mock)',
    run(args) {
      if (!args.length || args[0] === '~') { _cwd = '~'; return []; }
      _cwd = args[0];
      return [];
    },
  },
  theme: {
    desc: 'Set theme (dark|light|midnight|paper|ocean|forest)',
    run(args) {
      const t = args[0];
      const valid = ['dark', 'light', 'midnight', 'paper', 'ocean', 'forest'];
      if (!valid.includes(t)) return ['Valid themes: ' + valid.join(', ')];
      store.set('theme', t);
      return ['Theme set to ' + t];
    },
  },
  open: {
    desc: 'Open an app by id',
    run(args) {
      if (!args.length) return ['usage: open <appId>'];
      bus.emit('app:open', args[0]);
      return ['Opening ' + args[0] + '...'];
    },
  },
  notify: {
    desc: 'Send a desktop notification',
    run(args) {
      if (!args.length) return ['usage: notify <message>'];
      const msg = args.join(' ');
      toast.info(msg);
      return ['Sent: ' + msg];
    },
  },
  calc: {
    desc: 'Evaluate a math expression',
    run(args) {
      const expr = args.join(' ');
      try {
        const result = Function('"use strict";return (' + expr + ')')();
        return [String(result)];
      } catch (e) {
        return ['error: ' + e.message];
      }
    },
  },
  history: {
    desc: 'Show command history',
    run() { return _history.map((h, i) => String(i + 1).padStart(4) + '  ' + h); },
  },
  about: {
    desc: 'About AURORA OS',
    run() { return ['AURORA OS v1.0.0', 'Browser-native desktop workspace', 'No dependencies · No build step']; },
  },
};

function appendLine(text, type = '') {
  if (!text) return;
  const el = h('div', { class: 'term-line' + (type ? ' term-line--' + type : '') });
  el.textContent = text;
  _output.append(el);
  _output.scrollTop = _output.scrollHeight;
}

function runCommand(raw) {
  const input = raw.trim();
  if (!input) return;
  appendLine(_cwd + ' $ ' + input, 'cmd');
  _history.push(input);
  _historyIdx = _history.length;
  const [name, ...args] = input.split(/\s+/);
  const cmd = COMMANDS[name];
  if (!cmd) {
    appendLine('command not found: ' + name, 'err');
    appendLine('Type "help" for available commands.', 'dim');
    return;
  }
  try {
    const result = cmd.run(args);
    for (const line of result) appendLine(line);
  } catch (e) {
    appendLine('error: ' + e.message, 'err');
  }
}

export function mount(container) {
  clear(container);
  _root = h('div', { class: 'term-wrap' });
  _output = h('div', { class: 'term-output' });
  _root.append(_output);

  appendLine('AURORA OS Terminal v1.0.0', 'ok');
  appendLine('Type "help" for available commands.', 'dim');
  appendLine('');

  const promptLine = h('div', { class: 'term-prompt-line' });
  promptLine.append(h('span', { class: 'term-prompt', text: _cwd + ' $' }));
  _input = h('input', { class: 'term-input', type: 'text', spellcheck: 'false', autocomplete: 'off' });
  promptLine.append(_input);
  _root.append(promptLine);

  _input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = _input.value;
      _input.value = '';
      runCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (_historyIdx > 0) {
        _historyIdx--;
        _input.value = _history[_historyIdx] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (_historyIdx < _history.length - 1) {
        _historyIdx++;
        _input.value = _history[_historyIdx] || '';
      } else {
        _historyIdx = _history.length;
        _input.value = '';
      }
    }
  });

  container.append(_root);
  setTimeout(() => _input.focus(), 50);
}

export default { meta, mount };
