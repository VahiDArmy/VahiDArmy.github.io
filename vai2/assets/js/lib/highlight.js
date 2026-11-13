/* ============================================================
   NEXUS CHAT — MINIMAL SYNTAX HIGHLIGHTER
   Zero-dependency regex-based tokenizer.
   Attaches to window.Nexus.Highlight.

   Supported: javascript, typescript, jsx, tsx, python, html, xml,
              css, scss, json, sql, bash, sh, shell, go, rust,
              java, c, cpp, cs, php, ruby, yaml, toml, markdown.

   Usage: Nexus.Highlight.highlight(code, language) -> HTML
   ============================================================ */
(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Language specifications ---------- */
  const COMMON_KEYWORDS = {
    'true': 1, 'false': 1, 'null': 1, 'undefined': 1, 'NaN': 1, 'Infinity': 1,
  };

  const LANG_SPECS = {
    javascript: {
      keywords: [
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
        'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
        'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'static',
        'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while',
        'with', 'yield', 'async', 'await', 'of', 'from', 'as', 'get', 'set',
      ],
      builtins: [
        'console', 'window', 'document', 'Math', 'JSON', 'Object', 'Array', 'String',
        'Number', 'Boolean', 'Date', 'RegExp', 'Error', 'Promise', 'Map', 'Set',
        'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect', 'parseInt', 'parseFloat',
        'isNaN', 'isFinite', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      ],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/, /`(?:\\.|[^`\\])*`/],
      numbers: [/\b0[xX][0-9a-fA-F]+\b/, /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/],
    },
    typescript: {
      keywords: [
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
        'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for',
        'function', 'if', 'import', 'in', 'instanceof', 'interface', 'let', 'new',
        'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
        'var', 'void', 'while', 'with', 'yield', 'async', 'await', 'of', 'from',
        'as', 'implements', 'private', 'protected', 'public', 'readonly', 'abstract',
        'declare', 'namespace', 'type', 'keyof', 'infer', 'is', 'asserts',
      ],
      builtins: [
        'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
        'Promise', 'Map', 'Set', 'Record', 'Partial', 'Readonly', 'Pick', 'Omit',
        'Exclude', 'Extract', 'NonNullable', 'Parameters', 'ReturnType',
      ],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/, /`(?:\\.|[^`\\])*`/],
      numbers: [/\b0[xX][0-9a-fA-F]+\b/, /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/],
    },
    python: {
      keywords: [
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
        'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
        'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
        'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
      ],
      builtins: [
        'print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list', 'dict',
        'set', 'tuple', 'type', 'isinstance', 'issubclass', 'super', 'self',
        'object', 'Exception', 'ValueError', 'TypeError', 'KeyError', 'open',
        '__init__', '__name__', '__main__', 'enumerate', 'zip', 'map', 'filter',
        'sorted', 'sum', 'min', 'max', 'abs', 'all', 'any',
      ],
      comments: [/#[^\n]*/],
      strings: [
        /"""(?:[\s\S]*?)"""/,
        /'''(?:[\s\S]*?)'''/,
        /"(?:\\.|[^"\\])*"/,
        /'(?:\\.|[^'\\])*'/,
      ],
      numbers: [/\b0[xX][0-9a-fA-F]+\b/, /\b0[oO][0-7]+\b/, /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/],
    },
    html: {
      keywords: [],
      builtins: [],
      comments: [/<!--[\s\S]*?-->/],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b\d+\b/],
      special: 'html',
    },
    xml: { special: 'html', comments: [/<!--[\s\S]*?-->/], strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/], keywords: [], builtins: [], numbers: [] },
    css: {
      keywords: [],
      builtins: [],
      comments: [/\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/#[0-9a-fA-F]{3,8}\b/, /\b\d+\.?\d*(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/],
      special: 'css',
    },
    scss: {
      keywords: ['@import', '@mixin', '@include', '@extend', '@if', '@else', '@for', '@each', '@while', '@function', '@return'],
      builtins: [],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/#[0-9a-fA-F]{3,8}\b/, /\b\d+\.?\d*(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/],
    },
    json: {
      keywords: ['true', 'false', 'null'],
      builtins: [],
      comments: [/\/\/[^\n]*/],
      strings: [/"(?:\\.|[^"\\])*"/],
      numbers: [/-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/],
    },
    sql: {
      keywords: [
        'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'INTO', 'VALUES',
        'SET', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'AND', 'OR',
        'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'ORDER', 'BY', 'GROUP',
        'HAVING', 'LIMIT', 'OFFSET', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX',
        'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CHECK',
        'CONSTRAINT', 'CASCADE', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'EXISTS', 'WITH',
      ],
      builtins: [
        'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'VARCHAR', 'TEXT', 'CHAR', 'BOOLEAN',
        'DATE', 'TIMESTAMP', 'NUMERIC', 'DECIMAL', 'REAL', 'FLOAT', 'UUID',
      ],
      comments: [/--[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/'(?:\\.|[^'\\])*'/],
      numbers: [/\b\d+\.?\d*\b/],
      caseInsensitive: true,
    },
    bash: {
      keywords: [
        'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case',
        'esac', 'in', 'function', 'return', 'exit', 'break', 'continue',
      ],
      builtins: [
        'echo', 'cd', 'pwd', 'ls', 'cat', 'grep', 'awk', 'sed', 'find', 'which',
        'export', 'source', 'alias', 'unalias', 'set', 'unset', 'read', 'printf',
        'test', 'true', 'false', 'sudo', 'chmod', 'chown', 'mkdir', 'rm', 'cp',
        'mv', 'touch', 'curl', 'wget', 'git', 'npm', 'yarn', 'pnpm', 'node',
      ],
      comments: [/#[^\n]*/],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b\d+\b/],
    },
    go: {
      keywords: [
        'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
        'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
        'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
        'var',
      ],
      builtins: [
        'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'panic', 'recover',
        'print', 'println', 'int', 'string', 'bool', 'error', 'nil', 'true', 'false',
        'fmt', 'Printf', 'Println', 'Sprintf',
      ],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /`[^`]*`/],
      numbers: [/\b0[xX][0-9a-fA-F]+\b/, /\b\d+\.?\d*\b/],
    },
    rust: {
      keywords: [
        'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn',
        'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let',
        'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self',
        'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe',
        'use', 'where', 'while', 'yield',
      ],
      builtins: [
        'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64',
        'u128', 'usize', 'f32', 'f64', 'bool', 'char', 'str', 'String', 'Vec',
        'Option', 'Result', 'Box', 'Rc', 'Arc', 'HashMap', 'HashSet', 'Some', 'None',
        'Ok', 'Err',
      ],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /r#*"[\s\S]*?"#*/],
      numbers: [/\b0[xX][0-9a-fA-F]+\b/, /\b\d+\.?\d*\b/],
    },
    java: {
      keywords: [
        'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
        'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
        'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
        'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
        'package', 'private', 'protected', 'public', 'return', 'short', 'static',
        'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
        'transient', 'try', 'void', 'volatile', 'while',
      ],
      builtins: [
        'String', 'Integer', 'Long', 'Short', 'Byte', 'Character', 'Boolean',
        'Float', 'Double', 'Object', 'System', 'Math', 'List', 'ArrayList',
        'Map', 'HashMap', 'Set', 'HashSet', 'Collection', 'Arrays', 'StringBuilder',
        'Exception', 'RuntimeException',
      ],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b0[xX][0-9a-fA-F]+\b/, /\b\d+\.?\d*[fFdD]?\b/],
    },
    c: {
      keywords: [
        'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
        'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline',
        'int', 'long', 'register', 'restrict', 'return', 'short', 'signed', 'sizeof',
        'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
        'volatile', 'while',
      ],
      builtins: [
        'printf', 'scanf', 'malloc', 'free', 'calloc', 'realloc', 'sizeof',
        'NULL', 'stdin', 'stdout', 'stderr', 'FILE', 'fopen', 'fclose', 'fread',
        'fwrite', 'fprintf', 'strlen', 'strcpy', 'strcmp', 'memcpy', 'memset',
      ],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b0[xX][0-9a-fA-F]+[uUlL]*\b/, /\b\d+\.?\d*[fFlL]?\b/],
    },
    cpp: {
      keywords: [
        'alignas', 'alignof', 'auto', 'bool', 'break', 'case', 'catch', 'char',
        'class', 'const', 'constexpr', 'continue', 'decltype', 'default', 'delete',
        'do', 'double', 'else', 'enum', 'explicit', 'export', 'extern', 'false',
        'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable',
        'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'private',
        'protected', 'public', 'register', 'return', 'short', 'signed', 'sizeof',
        'static', 'static_cast', 'struct', 'switch', 'template', 'this', 'throw',
        'true', 'try', 'typedef', 'typename', 'union', 'unsigned', 'using',
        'virtual', 'void', 'volatile', 'while',
      ],
      builtins: [
        'std', 'cout', 'cin', 'cerr', 'endl', 'string', 'vector', 'map', 'set',
        'unordered_map', 'unordered_set', 'pair', 'tuple', 'shared_ptr',
        'unique_ptr', 'make_shared', 'make_unique', 'move', 'forward', 'swap',
      ],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b0[xX][0-9a-fA-F]+[uUlL]*\b/, /\b\d+\.?\d*[fFlL]?\b/],
    },
    cs: {
      keywords: [
        'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char',
        'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
        'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false',
        'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit',
        'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace',
        'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private',
        'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed',
        'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch',
        'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked',
        'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
      ],
      builtins: [
        'Console', 'Math', 'String', 'Int32', 'Int64', 'Boolean', 'List',
        'Dictionary', 'HashSet', 'Array', 'Exception', 'Task', 'async', 'await',
        'var', 'dynamic',
      ],
      comments: [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/\$?"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b0[xX][0-9a-fA-F]+\b/, /\b\d+\.?\d*[fFdDmM]?\b/],
    },
    php: {
      keywords: [
        'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch',
        'class', 'clone', 'const', 'continue', 'declare', 'default', 'die', 'do',
        'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach',
        'endif', 'endswitch', 'endwhile', 'eval', 'exit', 'extends', 'final',
        'finally', 'fn', 'for', 'foreach', 'function', 'global', 'goto', 'if',
        'implements', 'include', 'include_once', 'instanceof', 'insteadof',
        'interface', 'isset', 'list', 'match', 'namespace', 'new', 'or', 'print',
        'private', 'protected', 'public', 'readonly', 'require', 'require_once',
        'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use',
        'var', 'while', 'xor', 'yield',
      ],
      builtins: [
        'echo', 'print', 'strlen', 'count', 'array_map', 'array_filter',
        'array_merge', 'implode', 'explode', 'json_encode', 'json_decode',
        'var_dump', 'print_r', 'sprintf', 'printf',
      ],
      comments: [/\/\/[^\n]*/, /#[^\n]*/, /\/\*[\s\S]*?\*\//],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b\d+\.?\d*\b/],
      startTags: /<\?php|<\?=/,
    },
    ruby: {
      keywords: [
        'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?',
        'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in', 'module',
        'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return', 'self',
        'super', 'then', 'true', 'undef', 'unless', 'until', 'when', 'while', 'yield',
      ],
      builtins: [
        'puts', 'print', 'p', 'require', 'require_relative', 'attr_accessor',
        'attr_reader', 'attr_writer', 'include', 'extend', 'lambda', 'proc',
        'String', 'Integer', 'Float', 'Array', 'Hash', 'Symbol',
      ],
      comments: [/#[^\n]*/],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b\d+\.?\d*\b/],
    },
    yaml: {
      keywords: ['true', 'false', 'null', 'yes', 'no', 'on', 'off'],
      builtins: [],
      comments: [/#[^\n]*/],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b\d+\.?\d*\b/],
      special: 'yaml',
    },
    toml: {
      keywords: ['true', 'false'],
      builtins: [],
      comments: [/#[^\n]*/],
      strings: [/"(?:\\.|[^"\\])*"/, /'(?:\\.|[^'\\])*'/],
      numbers: [/\b\d+\.?\d*\b/],
    },
    markdown: {
      keywords: [],
      builtins: [],
      comments: [],
      strings: [],
      numbers: [],
      special: 'markdown',
    },
    plaintext: null,
    text: null,
  };

  // Alias map
  const ALIASES = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', python3: 'python',
    sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
    htm: 'html', xhtml: 'html', svg: 'xml',
    yml: 'yaml',
    rs: 'rust',
    golang: 'go',
    'c++': 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hxx: 'cpp', h: 'c',
    'c#': 'cs', csharp: 'cs',
    rb: 'ruby',
    md: 'markdown', mdx: 'markdown',
    jsonc: 'json', json5: 'json',
    postgres: 'sql', postgresql: 'sql', mysql: 'sql', sqlite: 'sql',
  };

  /* ---------- Tokenizer ---------- */
  function tokenize(code, spec) {
    const tokens = [];
    let i = 0;
    const len = code.length;

    const kwSet = new Set(spec.keywords || []);
    const builtinSet = new Set(spec.builtins || []);
    const caseInsensitive = !!spec.caseInsensitive;

    const tryMatch = (regexps) => {
      if (!regexps) return null;
      for (const re of regexps) {
        re.lastIndex = 0;
        const m = re.exec(code.slice(i));
        if (m && m.index === 0) return m[0];
      }
      return null;
    };

    while (i < len) {
      const rest = code.slice(i);

      // Comments
      const comment = tryMatch(spec.comments);
      if (comment) {
        tokens.push({ type: 'comment', value: comment });
        i += comment.length;
        continue;
      }

      // Strings
      const str = tryMatch(spec.strings);
      if (str) {
        tokens.push({ type: 'string', value: str });
        i += str.length;
        continue;
      }

      // Numbers
      const num = tryMatch(spec.numbers);
      if (num) {
        tokens.push({ type: 'number', value: num });
        i += num.length;
        continue;
      }

      // HTML/XML special handling
      if (spec.special === 'html') {
        const ch = code[i];
        if (ch === '<') {
          const closeIdx = code.indexOf('>', i);
          if (closeIdx !== -1) {
            const tag = code.slice(i, closeIdx + 1);
            // Split tag into tag name, attributes
            const tagMatch = tag.match(/^(<\/?)([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*?)(\/?>)$/);
            if (tagMatch) {
              const [, open, name, attrs, close] = tagMatch;
              tokens.push({ type: 'punct', value: open });
              tokens.push({ type: 'tag', value: name });
              // Simple attribute highlighting
              const attrRe = /(\s+)([a-zA-Z_:][a-zA-Z0-9_.:-]*)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g;
              let a;
              while ((a = attrRe.exec(attrs)) !== null) {
                tokens.push({ type: 'plain', value: a[1] });
                tokens.push({ type: 'attr', value: a[2] });
                tokens.push({ type: 'operator', value: a[3] });
                if (a[4]) tokens.push({ type: 'string', value: a[4] });
              }
              tokens.push({ type: 'punct', value: close });
            } else {
              tokens.push({ type: 'tag', value: tag });
            }
            i += tag.length;
            continue;
          }
        }
        tokens.push({ type: 'plain', value: ch });
        i++;
        continue;
      }

      // CSS special handling
      if (spec.special === 'css') {
        // Selectors before {
        const ch = code[i];
        if (ch === '{' || ch === '}' || ch === ':' || ch === ';') {
          tokens.push({ type: 'operator', value: ch });
          i++;
          continue;
        }
      }

      // Identifiers / keywords
      const idMatch = rest.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
      if (idMatch) {
        const word = idMatch[0];
        const cmp = caseInsensitive ? word.toLowerCase() : word;
        const kwCheck = caseInsensitive
          ? (spec.keywords || []).some(k => k.toLowerCase() === cmp)
          : kwSet.has(word);
        const biCheck = caseInsensitive
          ? (spec.builtins || []).some(b => b.toLowerCase() === cmp)
          : builtinSet.has(word);

        if (kwCheck) {
          tokens.push({ type: 'keyword', value: word });
        } else if (biCheck) {
          tokens.push({ type: 'builtin', value: word });
        } else {
          // Check if next non-whitespace char is '('
          let j = i + word.length;
          while (j < len && /\s/.test(code[j])) j++;
          if (code[j] === '(') {
            tokens.push({ type: 'function', value: word });
          } else if (word.length > 0 && /^[A-Z]/.test(word) && word === word.toUpperCase() === false) {
            // Capitalized identifiers likely classes — but skip to avoid false positives
            tokens.push({ type: 'plain', value: word });
          } else {
            tokens.push({ type: 'plain', value: word });
          }
        }
        i += word.length;
        continue;
      }

      // Operators / punctuation
      const opMatch = rest.match(/^[+\-*/%=<>!&|^~?:]+/);
      if (opMatch) {
        tokens.push({ type: 'operator', value: opMatch[0] });
        i += opMatch[0].length;
        continue;
      }

      const punctMatch = rest.match(/^[()[\]{}.,;]/);
      if (punctMatch) {
        tokens.push({ type: 'punct', value: punctMatch[0] });
        i += punctMatch[0].length;
        continue;
      }

      // Whitespace
      const wsMatch = rest.match(/^\s+/);
      if (wsMatch) {
        tokens.push({ type: 'plain', value: wsMatch[0] });
        i += wsMatch[0].length;
        continue;
      }

      // Fallback
      tokens.push({ type: 'plain', value: code[i] });
      i++;
    }

    return tokens;
  }

  /* ---------- Render tokens to HTML ---------- */
  function tokensToHtml(tokens) {
    return tokens.map(t => {
      const cls = t.type === 'plain' ? 'tok-plain' : `tok-${t.type}`;
      return `<span class="${cls}">${escapeHtml(t.value)}</span>`;
    }).join('');
  }

  /* ---------- Public API ---------- */
  function highlight(code, language) {
    if (code == null) return '';
    const lang = (language || 'plaintext').toLowerCase().trim();
    const resolved = ALIASES[lang] || lang;
    const spec = LANG_SPECS[resolved];

    if (!spec) {
      // Unknown language — just escape
      return escapeHtml(code);
    }

    // Markdown special: just escape, let markdown renderer handle it
    if (spec.special === 'markdown') {
      return escapeHtml(code);
    }

    try {
      const tokens = tokenize(code, spec);
      return tokensToHtml(tokens);
    } catch (e) {
      return escapeHtml(code);
    }
  }

  /* ---------- Detect language from code ---------- */
  function detectLanguage(code) {
    if (!code) return 'plaintext';
    const sample = code.slice(0, 500);

    if (/^\s*<!DOCTYPE|<\?xml|<\?php/i.test(sample)) {
      if (/<\?php/i.test(sample)) return 'php';
      if (/<\?xml/i.test(sample)) return 'xml';
      return 'html';
    }
    if (/^\s*\{[\s\S]*"[^"]+"\s*:/m.test(sample) && /[\{\}].*[\{\}]/.test(sample)) {
      return 'json';
    }
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/i.test(sample)) {
      return 'sql';
    }
    if (/^\s*(#include|using\s+namespace|template\s*<)/i.test(sample)) {
      return 'cpp';
    }
    if (/^\s*(function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|=>)/m.test(sample)) {
      if (/\b(interface|type\s+\w+\s*=|:\s*(string|number|boolean|void|any)\b)/.test(sample)) {
        return 'typescript';
      }
      return 'javascript';
    }
    if (/^\s*(def\s+\w+|class\s+\w+.*:|import\s+\w+|from\s+\w+\s+import)/m.test(sample)) {
      return 'python';
    }
    if (/^\s*(package\s+\w+|func\s+\w+|import\s+\()/m.test(sample)) {
      return 'go';
    }
    if (/^\s*(fn\s+\w+|use\s+std::|let\s+mut\s+\w+)/m.test(sample)) {
      return 'rust';
    }
    if (/^\s*(public\s+class|import\s+java\.|System\.out)/m.test(sample)) {
      return 'java';
    }
    if (/^\s*(#\s*\w+|::\s*\w+|\$\w+\s*=)/m.test(sample)) {
      return 'bash';
    }
    if (/^\s*(body\s*\{|\.[a-z-]+\s*\{|#[a-z-]+\s*\{)/i.test(sample)) {
      return 'css';
    }
    return 'plaintext';
  }

  /* ---------- Export ---------- */
  window.Nexus = window.Nexus || {};
  window.Nexus.Highlight = {
    highlight,
    detectLanguage,
    languages: Object.keys(LANG_SPECS),
    escapeHtml,
  };
})();
