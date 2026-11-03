/* =========================================================
   Markdown → HTML for AI output
   Self-contained, no dependencies, tuned for Persian prose.
   ========================================================= */
(function (UI) {
  'use strict';

  function splitRow(line) {
    var l = line.trim();
    if (l.charAt(0) === '|') l = l.slice(1);
    if (l.charAt(l.length - 1) === '|') l = l.slice(0, -1);
    return l.split('|').map(function (c) { return c.trim(); });
  }

  function alignOf(cell) {
    var t = String(cell || '').trim();
    var left = t.charAt(0) === ':';
    var right = t.charAt(t.length - 1) === ':';
    if (left && right) return 'center';
    if (right) return 'left';
    if (left) return 'right';
    return '';
  }

  function table(block) {
    var lines = block.trim().split('\n').filter(function (l) { return l.trim(); });
    if (lines.length < 2) return null;
    var head = splitRow(lines[0]);
    var aligns = splitRow(lines[1]).map(alignOf);
    var body = lines.slice(2).map(splitRow);
    var out = '<div class="tablewrap"><table>';
    out += '<thead><tr>' + head.map(function (cell, i) {
      return '<th' + (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' + cell + '</th>';
    }).join('') + '</tr></thead>';
    if (body.length) {
      out += '<tbody>' + body.map(function (row) {
        return '<tr>' + head.map(function (_, i) {
          return '<td' + (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' +
            (row[i] != null ? row[i] : '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
    }
    return out + '</table></div>';
  }

  function render(text) {
    if (!text) return '';
    var source = String(text);
    var codeBlocks = [];

    /* fenced code */
    source = source.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      codeBlocks.push('<pre' + (lang ? ' data-lang="' + lang + '"' : '') + '><code>' +
        UI.esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\u0000C' + (codeBlocks.length - 1) + '\u0000';
    });

    var s = UI.esc(source);

    /* tables */
    s = s.replace(/(?:^|\n)((?:[ \t]*\|[^\n]*\|[ \t]*\n)+)/g, function (whole, block) {
      var rendered = table(block);
      return rendered ? '\n\n' + rendered + '\n\n' : whole;
    });

    /* headings */
    s = s.replace(/^######[ \t]+(.+?)[ \t]*$/gm, '<h6>$1</h6>');
    s = s.replace(/^#####[ \t]+(.+?)[ \t]*$/gm, '<h5>$1</h5>');
    s = s.replace(/^####[ \t]+(.+?)[ \t]*$/gm, '<h4>$1</h4>');
    s = s.replace(/^###[ \t]+(.+?)[ \t]*$/gm, '<h3>$1</h3>');
    s = s.replace(/^##[ \t]+(.+?)[ \t]*$/gm, '<h2>$1</h2>');
    s = s.replace(/^#[ \t]+(.+?)[ \t]*$/gm, '<h1>$1</h1>');

    /* rules */
    s = s.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '<hr>');

    /* blockquote */
    s = s.replace(/(?:^|\n)((?:&gt;[ \t]?[^\n]*(?:\n|$))+)/g, function (_, block) {
      var lines = block.trim().split('\n').map(function (l) { return l.replace(/^&gt;[ \t]?/, ''); });
      return '\n<blockquote>' + lines.join('<br>') + '</blockquote>\n';
    });

    /* lists */
    s = s.replace(/(?:^|\n)((?:[ \t]*[-*+][ \t]+[^\n]+(?:\n|$))+)/g, function (_, block) {
      var items = block.trim().split('\n').map(function (l) { return l.replace(/^[ \t]*[-*+][ \t]+/, ''); });
      return '\n<ul>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>\n';
    });
    s = s.replace(/(?:^|\n)((?:[ \t]*\d+\.[ \t]+[^\n]+(?:\n|$))+)/g, function (_, block) {
      var items = block.trim().split('\n').map(function (l) { return l.replace(/^[ \t]*\d+\.[ \t]+/, ''); });
      return '\n<ol>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ol>\n';
    });

    /* inline emphasis */
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    s = s.replace(/(?<![*_\w])_([^_\n]+)_(?!_)/g, '<em>$1</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    s = s.replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    s = s.replace(/\u0000C(\d+)\u0000/g, function (_, idx) { return codeBlocks[Number(idx)] || ''; });

    return s.split(/\n{2,}/).map(function (block) {
      var t = block.trim();
      if (!t) return '';
      if (/^<(h\d|ul|ol|pre|hr|blockquote|div|table|thead|tbody|tr|td|th|p)/i.test(t)) return t;
      return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  UI.md = render;
})(window.UI);
