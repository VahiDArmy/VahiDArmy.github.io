/* ============================================================
   NEXUS CHAT — SEARCH FEATURE
   Global search (Ctrl+K) across chat titles and messages.

   - Fuzzy-scored substring matching
   - Filter chips: All / Titles / Messages
   - Keyboard navigation (↑ ↓ Enter Esc)
   - Query history
   - Jump-to-message with flash highlight
   - Auto-unarchives archived chats on open
   ============================================================ */
(function () {
  'use strict';

  if (window.__nexus_search_loaded__) return;
  window.__nexus_search_loaded__ = true;

  const HISTORY_KEY = 'nexus_search_history_v1';
  const MAX_HISTORY = 8;
  const MAX_RESULTS = 60;

  let overlayEl = null;
  let inputEl = null;
  let resultsEl = null;
  let filterEl = null;
  let historyEl = null;
  let currentFilter = 'all';
  let currentResults = [];
  let activeIndex = 0;
  let searchTimeout = null;

  /* ---------- Boot ---------- */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    mountButton();
    buildOverlay();
    bindGlobalKeys();
  });

  /* ---------- Mount top-bar button ---------- */
  function mountButton() {
    const topBar = document.querySelector('.top-bar-right');
    if (!topBar) return;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'nxSearchBtn';
    btn.title = 'Search (Ctrl+K)';
    btn.setAttribute('aria-label', 'Search conversations');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="7" cy="7" r="4.5"/>
        <path d="M10.5 10.5L14 14"/>
      </svg>`;
    btn.addEventListener('click', openSearch);
    topBar.insertBefore(btn, topBar.firstChild);
  }

  /* ---------- Build overlay ---------- */
  function buildOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'nx-search-overlay';
    overlayEl.id = 'nxSearchOverlay';
    overlayEl.innerHTML = `
      <div class="nx-search-panel" role="dialog" aria-modal="true" aria-label="Search">
        <div class="nx-search-input-row">
          <div class="nx-search-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="7" cy="7" r="4.5"/>
              <path d="M10.5 10.5L14 14"/>
            </svg>
          </div>
          <input type="text" class="nx-search-input" id="nxSearchInput"
                 placeholder="Search titles and messages…" autocomplete="off" spellcheck="false" />
          <span class="nx-search-kbd">Esc</span>
        </div>
        <div class="nx-search-filters" id="nxSearchFilters">
          <button class="nx-search-filter active" data-filter="all">All</button>
          <button class="nx-search-filter" data-filter="title">Titles</button>
          <button class="nx-search-filter" data-filter="message">Messages</button>
          <button class="nx-search-filter" data-filter="user">From me</button>
          <button class="nx-search-filter" data-filter="assistant">From AI</button>
        </div>
        <div class="nx-search-history" id="nxSearchHistory" style="display:none;"></div>
        <div class="nx-search-results" id="nxSearchResults"></div>
        <div class="nx-search-footer">
          <div class="nx-search-footer-group">
            <span class="nx-search-footer-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span class="nx-search-footer-hint"><kbd>↵</kbd> open</span>
          </div>
          <div class="nx-search-footer-group">
            <span class="nx-search-footer-hint" id="nxSearchCount">—</span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlayEl);

    inputEl = overlayEl.querySelector('#nxSearchInput');
    resultsEl = overlayEl.querySelector('#nxSearchResults');
    filterEl = overlayEl.querySelector('#nxSearchFilters');
    historyEl = overlayEl.querySelector('#nxSearchHistory');

    overlayEl.addEventListener('mousedown', (e) => {
      if (e.target === overlayEl) closeSearch();
    });

    inputEl.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => runSearch(), 90);
    });

    inputEl.addEventListener('keydown', onInputKey);

    filterEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.nx-search-filter');
      if (!btn) return;
      currentFilter = btn.dataset.filter;
      filterEl.querySelectorAll('.nx-search-filter').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
      runSearch();
    });

    historyEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.nx-search-history-chip');
      if (!chip) return;
      inputEl.value = chip.dataset.query;
      runSearch();
      inputEl.focus();
    });
  }

  /* ---------- Global keybindings ---------- */
  function bindGlobalKeys() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (overlayEl.classList.contains('open')) closeSearch();
        else openSearch();
        return;
      }
      if (!overlayEl.classList.contains('open')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
      }
    });
  }

  /* ---------- Open / close ---------- */
  function openSearch(prefill) {
    overlayEl.classList.add('open');
    inputEl.value = typeof prefill === 'string' ? prefill : '';
    currentResults = [];
    activeIndex = 0;
    renderHistory();
    renderResults();
    requestAnimationFrame(() => inputEl.focus());
    if (inputEl.value) runSearch();
  }

  function closeSearch() {
    overlayEl.classList.remove('open');
    inputEl.value = '';
  }

  /* ---------- Search engine ---------- */
  function scoreMatch(haystack, needle) {
    if (!haystack || !needle) return null;
    const h = haystack.toLowerCase();
    const n = needle.toLowerCase();
    const idx = h.indexOf(n);
    if (idx === -1) return null;

    let score = 10;
    if (idx === 0) score += 25;
    if (h === n) score += 60;
    if (idx === 0 || /[\s\n.,;:!?()\[\]{}"'`<>/\\]/.test(h[idx - 1] || '')) score += 8;

    // Multiple occurrences bonus (cap at 3)
    let occurrences = 0;
    let pos = 0;
    while ((pos = h.indexOf(n, pos)) !== -1 && occurrences < 3) {
      occurrences++;
      pos += n.length;
    }
    score += occurrences * 3;

    return { score, idx, length: n.length };
  }

  function makeSnippet(text, matchIdx, matchLen) {
    const maxLen = 140;
    let start = Math.max(0, matchIdx - 40);
    let end = Math.min(text.length, matchIdx + matchLen + 100);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    return snippet;
  }

  function highlightSnippet(text, query) {
    if (!query) return window.__nexus.escapeHtml(text);
    const escaped = window.__nexus.escapeHtml(text);
    const lower = escaped.toLowerCase();
    const q = query.toLowerCase();
    let result = '';
    let pos = 0;
    let idx;
    while ((idx = lower.indexOf(q, pos)) !== -1) {
      result += escaped.slice(pos, idx);
      result += '<mark>' + escaped.slice(idx, idx + q.length) + '</mark>';
      pos = idx + q.length;
    }
    result += escaped.slice(pos);
    return result;
  }

  function runSearch() {
    const query = inputEl.value.trim();
    if (!query) {
      currentResults = [];
      activeIndex = 0;
      renderResults();
      return;
    }

    const state = window.__nexus.state;
    const chats = state.chats || [];
    const results = [];

    for (const chat of chats) {
      const isArchived = isChatArchived(chat.id);

      // Title matches
      if (currentFilter === 'all' || currentFilter === 'title') {
        const m = scoreMatch(chat.title, query);
        if (m) {
          results.push({
            type: 'title',
            chatId: chat.id,
            chatTitle: chat.title,
            messageIndex: null,
            role: null,
            snippet: chat.title,
            matchIdx: m.idx,
            matchLen: m.length,
            score: m.score + 5, // titles slightly favored
            archived: isArchived,
          });
        }
      }

      // Message matches
      if (currentFilter === 'all' || currentFilter === 'message' ||
          currentFilter === 'user' || currentFilter === 'assistant') {
        chat.messages.forEach((msg, idx) => {
          if (!msg.content) return;
          if (currentFilter === 'user' && msg.role !== 'user') return;
          if (currentFilter === 'assistant' && msg.role !== 'assistant') return;

          const m = scoreMatch(msg.content, query);
          if (!m) return;

          results.push({
            type: 'message',
            chatId: chat.id,
            chatTitle: chat.title,
            messageIndex: idx,
            role: msg.role,
            snippet: makeSnippet(msg.content, m.idx, m.length),
            matchIdx: m.idx,
            matchLen: m.length,
            score: m.score,
            archived: isArchived,
          });
        });
      }
    }

    results.sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      return (a.chatTitle || '').localeCompare(b.chatTitle || '');
    });

    currentResults = results.slice(0, MAX_RESULTS);
    activeIndex = 0;
    renderResults();
    pushHistory(query);
  }

  function isChatArchived(chatId) {
    try {
      const raw = localStorage.getItem('nexus_folders_v1');
      if (!raw) return false;
      const data = JSON.parse(raw);
      return Array.isArray(data.archived) && data.archived.includes(chatId);
    } catch (e) { return false; }
  }

  /* ---------- History ---------- */
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function pushHistory(query) {
    if (!query || query.length < 2) return;
    let h = loadHistory();
    h = h.filter(x => x.toLowerCase() !== query.toLowerCase());
    h.unshift(query);
    h = h.slice(0, MAX_HISTORY);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) {}
    renderHistory();
  }

  function renderHistory() {
    const h = loadHistory();
    if (!h.length || inputEl.value) {
      historyEl.style.display = 'none';
      historyEl.innerHTML = '';
      return;
    }
    historyEl.style.display = 'flex';
    historyEl.innerHTML = h
      .map(q => `<button class="nx-search-history-chip" data-query="${window.__nexus.escapeHtml(q)}">${window.__nexus.escapeHtml(q)}</button>`)
      .join('');
  }

  /* ---------- Render results ---------- */
  function renderResults() {
    const query = inputEl.value.trim();
    const countEl = overlayEl.querySelector('#nxSearchCount');

    if (!query) {
      renderHistory();
      resultsEl.innerHTML = `
        <div class="nx-search-empty">
          <div class="big-icon">⌘K</div>
          Search across ${window.__nexus.state.chats.length} conversation${window.__nexus.state.chats.length === 1 ? '' : 's'}
        </div>`;
      if (countEl) countEl.textContent = '—';
      return;
    }

    if (!currentResults.length) {
      resultsEl.innerHTML = `
        <div class="nx-search-empty">
          <div class="big-icon">∅</div>
          No matches for <strong>"${window.__nexus.escapeHtml(query)}"</strong><br>
          <span style="font-size:11px;opacity:0.7;">Try a shorter query or a different filter.</span>
        </div>`;
      if (countEl) countEl.textContent = '0 results';
      return;
    }

    if (countEl) countEl.textContent = `${currentResults.length}${currentResults.length === MAX_RESULTS ? '+' : ''} result${currentResults.length === 1 ? '' : 's'}`;

    resultsEl.innerHTML = currentResults.map((r, i) => {
      const isActive = i === activeIndex;
      const roleLabel = r.role === 'user' ? 'You' : r.role === 'assistant' ? 'AI' : 'Title';
      const badge = r.type === 'title' ? 'TITLE' : roleLabel.toUpperCase();
      const archivedBadge = r.archived
        ? '<span class="nx-search-result-badge" style="color:var(--warning);border-color:var(--warning)">ARCHIVED</span>'
        : '';
      const snippetHtml = r.type === 'title'
        ? highlightSnippet(r.chatTitle, query)
        : highlightSnippet(r.snippet, query);

      return `
        <div class="nx-search-result ${isActive ? 'active' : ''}" data-index="${i}">
          <div class="nx-search-result-header">
            <div class="nx-search-result-title">${window.__nexus.escapeHtml(r.chatTitle)}</div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              ${archivedBadge}
              <span class="nx-search-result-badge">${badge}</span>
            </div>
          </div>
          <div class="nx-search-result-snippet">${snippetHtml}</div>
        </div>`;
    }).join('');

    resultsEl.querySelectorAll('.nx-search-result').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.index);
        activeIndex = idx;
        activateResult(currentResults[idx]);
      });
      el.addEventListener('mouseenter', () => {
        activeIndex = Number(el.dataset.index);
        resultsEl.querySelectorAll('.nx-search-result').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
      });
    });

    if (activeIndex >= 0) {
      const activeEl = resultsEl.querySelector(`.nx-search-result[data-index="${activeIndex}"]`);
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ---------- Keyboard navigation inside overlay ---------- */
  function onInputKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!currentResults.length) return;
      activeIndex = (activeIndex + 1) % currentResults.length;
      renderResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!currentResults.length) return;
      activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
      renderResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[activeIndex]) {
        activateResult(currentResults[activeIndex]);
      }
    } else if (e.key === 'Tab') {
      // Cycle filters
      e.preventDefault();
      const filters = ['all', 'title', 'message', 'user', 'assistant'];
      const cur = filters.indexOf(currentFilter);
      currentFilter = filters[(cur + (e.shiftKey ? -1 : 1) + filters.length) % filters.length];
      filterEl.querySelectorAll('.nx-search-filter').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === currentFilter);
      });
      runSearch();
    }
  }

  /* ---------- Activate a result ---------- */
  function activateResult(r) {
    if (!r) return;
    const state = window.__nexus.state;

    // Auto-unarchive
    try {
      const raw = localStorage.getItem('nexus_folders_v1');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.archived) && data.archived.includes(r.chatId)) {
          data.archived = data.archived.filter(id => id !== r.chatId);
          localStorage.setItem('nexus_folders_v1', JSON.stringify(data));
          window.dispatchEvent(new Event('nexus:folders-changed'));
        }
      }
    } catch (e) {}

    // Activate chat
    state.activeChatId = r.chatId;
    window.__nexus.renderChatList();
    window.__nexus.renderActiveChat();
    closeSearch();

    // Jump to message
    if (r.type === 'message' && r.messageIndex != null) {
      setTimeout(() => {
        const messagesWrap = document.getElementById('chatMessagesInner');
        if (!messagesWrap) return;
        const node = messagesWrap.children[r.messageIndex];
        if (node) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
          node.classList.add('nx-highlight-flash');
          setTimeout(() => node.classList.remove('nx-highlight-flash'), 1500);
        }
      }, 80);
    }
  }

  /* ---------- Public ---------- */
  window.Nexus = window.Nexus || {};
  window.Nexus.Search = {
    open: openSearch,
    close: closeSearch,
  };
})();
