// Starter templates for common project layouts.

export const TEMPLATES = [
  {
    id: 'react-vite',
    name: 'React + Vite',
    description: 'Minimal React app scaffolded with Vite. index.html, main entry, one component.',
    icon: '⚛',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'vite-react-app',
          private: true,
          version: '0.0.0',
          type: 'module',
          scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
          dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
          devDependencies: { '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.0' },
        }, null, 2) + '\n',
      },
      {
        path: 'index.html',
        content: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vite + React</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n',
      },
      {
        path: 'src/main.jsx',
        content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n",
      },
      {
        path: 'src/App.jsx',
        content: "import { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div className=\"app\">\n      <h1>Hello, Vite + React</h1>\n      <button onClick={() => setCount((c) => c + 1)}>\n        count is {count}\n      </button>\n    </div>\n  );\n}\n",
      },
      {
        path: 'src/index.css',
        content: ":root {\n  font-family: system-ui, -apple-system, sans-serif;\n  color-scheme: dark;\n  background: #0a0b0d;\n  color: #e7eaef;\n}\n\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; }\n\nbutton { padding: 8px 16px; border-radius: 6px; border: 1px solid #2a323d; background: #131820; color: inherit; cursor: pointer; }\n",
      },
    ],
  },
  {
    id: 'node-cli',
    name: 'Node CLI',
    description: 'Simple Node.js CLI with ESM. Reads args, prints greeting, has a test stub.',
    icon: '⬢',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'node-cli',
          version: '0.1.0',
          type: 'module',
          bin: { hello: './cli.js' },
          scripts: { test: 'node --test' },
        }, null, 2) + '\n',
      },
      {
        path: 'cli.js',
        content: '#!/usr/bin/env node\n\nconst [, , ...args] = process.argv;\nconst name = args[0] || "world";\n\nconsole.log(`hello, ${name}`);\n',
      },
      {
        path: 'test/cli.test.js',
        content: "import { test } from 'node:test';\nimport assert from 'node:assert';\n\ntest('greeting', () => {\n  assert.strictEqual(1 + 1, 2);\n});\n",
      },
    ],
  },
  {
    id: 'python-package',
    name: 'Python package',
    description: 'Minimal Python package with pyproject.toml, src layout, and one module.',
    icon: '🐍',
    files: [
      {
        path: 'pyproject.toml',
        content: '[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "my_package"\nversion = "0.1.0"\ndescription = "A minimal package"\nrequires-python = ">=3.10"\n',
      },
      {
        path: 'src/my_package/__init__.py',
        content: '"""My package."""\n\n__version__ = "0.1.0"\n\n\ndef greet(name: str) -> str:\n    return f"hello, {name}"\n',
      },
      {
        path: 'README.md',
        content: '# my_package\n\nMinimal Python package.\n',
      },
    ],
  },
  {
    id: 'static-site',
    name: 'Static site',
    description: 'One-page HTML/CSS/JS site. No build step.',
    icon: '◫',
    files: [
      {
        path: 'index.html',
        content: '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My Site</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <header>\n    <h1>Hello, world</h1>\n    <p>A tiny static site.</p>\n  </header>\n  <main>\n    <button id="cta">Click me</button>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>\n',
      },
      {
        path: 'styles.css',
        content: ':root { color-scheme: dark; }\nbody { margin: 0; font-family: system-ui, sans-serif; background: #0a0b0d; color: #e7eaef; }\nheader { padding: 48px 24px; text-align: center; }\nmain { display: grid; place-items: center; padding: 48px; }\nbutton { padding: 10px 20px; border-radius: 8px; border: 1px solid #2a323d; background: #131820; color: inherit; cursor: pointer; }\n',
      },
      {
        path: 'app.js',
        content: "const cta = document.getElementById('cta');\nlet n = 0;\ncta.addEventListener('click', () => {\n  n++;\n  cta.textContent = `clicked ${n}×`;\n});\n",
      },
    ],
  },
  {
    id: 'express-api',
    name: 'Express API',
    description: 'Node.js Express server with one route and a health check.',
    icon: '▤',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'express-api',
          version: '0.1.0',
          type: 'module',
          scripts: { start: 'node server.js' },
          dependencies: { express: '^4.19.2' },
        }, null, 2) + '\n',
      },
      {
        path: 'server.js',
        content: "import express from 'express';\n\nconst app = express();\napp.use(express.json());\n\napp.get('/health', (req, res) => res.json({ ok: true }));\n\napp.listen(3000, () => {\n  console.log('http://localhost:3000');\n});\n",
      },
    ],
  },
  {
    id: 'blank',
    name: 'Blank',
    description: 'Empty starter with a single README so you can paste anything.',
    icon: '∅',
    files: [
      { path: 'README.md', content: '# My Project\n\nDescribe what you are building here.\n' },
    ],
  },
];

export function findTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}
