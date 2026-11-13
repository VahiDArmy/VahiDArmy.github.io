/* ============================================================
   NEXUS CHAT — VOICE FEATURE
   Speech input (Web Speech API) + Text-to-speech (SpeechSynthesis).

   Auto-loaded by index.html. Injects its own CSS.

   Public API:
     window.Nexus.Voice.startListening()
     window.Nexus.Voice.stopListening()
     window.Nexus.Voice.toggleListening()
     window.Nexus.Voice.speak(text, opts)
     window.Nexus.Voice.stopSpeaking()
     window.Nexus.Voice.pauseSpeaking()
     window.Nexus.Voice.resumeSpeaking()
     window.Nexus.Voice.getSettings()
     window.Nexus.Voice.openSettings()
     window.Nexus.Voice.isSupported()
   ============================================================ */
(function () {
  'use strict';

  if (window.__nexus_voice_loaded__) return;
  window.__nexus_voice_loaded__ = true;

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const STORAGE_KEY = 'nexus_voice_settings_v1';
  const TTS_CHUNK_MAX = 240;

  const SUPPORTED_LANGUAGES = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'en-AU', label: 'English (Australia)' },
    { code: 'en-IN', label: 'English (India)' },
    { code: 'fa-IR', label: 'فارسی' },
    { code: 'ar-SA', label: 'العربية' },
    { code: 'es-ES', label: 'Español (España)' },
    { code: 'es-MX', label: 'Español (México)' },
    { code: 'fr-FR', label: 'Français' },
    { code: 'de-DE', label: 'Deutsch' },
    { code: 'it-IT', label: 'Italiano' },
    { code: 'pt-BR', label: 'Português (Brasil)' },
    { code: 'ru-RU', label: 'Русский' },
    { code: 'zh-CN', label: '中文 (普通话)' },
    { code: 'ja-JP', label: '日本語' },
    { code: 'ko-KR', label: '한국어' },
    { code: 'hi-IN', label: 'हिन्दी' },
    { code: 'tr-TR', label: 'Türkçe' },
    { code: 'nl-NL', label: 'Nederlands' },
    { code: 'pl-PL', label: 'Polski' },
    { code: 'sv-SE', label: 'Svenska' },
    { code: 'da-DK', label: 'Dansk' },
    { code: 'fi-FI', label: 'Suomi' },
    { code: 'nb-NO', label: 'Norsk' },
  ];

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    recognition: null,
    recognizerSupported: false,
    synthesizerSupported: false,
    isListening: false,
    isRecognizerStarted: false,
    interimTranscript: '',
    finalTranscript: '',
    restartOnEnd: false,
    errorCount: 0,

    ttsVoices: [],
    currentUtterance: null,
    isSpeaking: false,
    isPaused: false,
    currentChunks: [],
    currentChunkIdx: 0,

    settings: {
      language: 'en-US',
      autoSend: false,
      showInterim: true,
      continuous: false,
      autoStopOnSilence: true,
      ttsEnabled: true,
      ttsVoiceURI: '',
      ttsRate: 1.0,
      ttsPitch: 1.0,
      ttsVolume: 1.0,
      ttsAutoSpeak: false,
    },
  };

  /* ============================================================
     CSS INJECTION
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-voice-styles')) return;
    const css = `
/* ============================================================
   VOICE FEATURE
   ============================================================ */
.nx-mic-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  position: relative;
  margin-right: 6px;
}
.nx-mic-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.nx-mic-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.nx-mic-btn.listening {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
  animation: nx-mic-pulse 1.4s infinite;
}
@keyframes nx-mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(225, 112, 85, 0.55); }
  50%      { box-shadow: 0 0 0 8px rgba(225, 112, 85, 0); }
}
.nx-mic-btn.processing {
  background: var(--warning);
  border-color: var(--warning);
  color: #fff;
  animation: none;
}
.nx-mic-btn .nx-mic-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 4px rgba(255,255,255,0.6);
  animation: nx-mic-dot-blink 0.9s infinite;
}
@keyframes nx-mic-dot-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}

/* Interim bubble */
.nx-interim-bubble {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  max-width: 480px;
  padding: 8px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--accent-primary);
  border-radius: 12px;
  font-size: 13px;
  color: var(--text-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  z-index: 50;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  pointer-events: none;
  line-height: 1.5;
  animation: nx-interim-in 0.18s ease;
}
@keyframes nx-interim-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.nx-interim-bubble .dots {
  display: inline-flex;
  gap: 2px;
  flex-shrink: 0;
  margin-top: 4px;
}
.nx-interim-bubble .dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent-secondary);
  animation: nx-interim-dot 1.2s infinite;
}
.nx-interim-bubble .dots span:nth-child(2) { animation-delay: 0.2s; }
.nx-interim-bubble .dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes nx-interim-dot {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50%      { opacity: 1; transform: scale(1); }
}
.nx-interim-bubble .text {
  flex: 1;
  word-break: break-word;
}

/* TTS controls on messages */
.nx-tts-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 11px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0;
  margin-top: 6px;
}
.message:hover .nx-tts-btn,
.nx-tts-btn.speaking {
  opacity: 1;
}
.nx-tts-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.nx-tts-btn.speaking {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}
.nx-tts-btn.paused {
  background: var(--warning);
  border-color: var(--warning);
  color: var(--bg-primary);
}

/* TTS toolbar (global) — appears when speaking */
.nx-tts-toolbar {
  position: fixed;
  bottom: 90px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 1500;
  opacity: 0;
  transform: translateY(12px);
  pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
}
.nx-tts-toolbar.open {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.nx-tts-toolbar-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s;
}
.nx-tts-toolbar-btn:hover {
  background: var(--bg-hover);
}
.nx-tts-toolbar-btn.primary {
  background: var(--accent-primary);
  color: #fff;
}
.nx-tts-toolbar-btn.primary:hover {
  background: var(--accent-secondary);
}
.nx-tts-toolbar-info {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  padding: 0 8px;
  min-width: 60px;
  text-align: center;
}

/* Settings modal */
.nx-voice-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s;
}
.nx-voice-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-voice-modal {
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  transform: scale(0.96);
  transition: transform 0.18s;
}
.nx-voice-overlay.open .nx-voice-modal {
  transform: scale(1);
}
.nx-voice-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}
.nx-voice-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
}
.nx-voice-field {
  margin-bottom: 16px;
}
.nx-voice-field:last-child {
  margin-bottom: 0;
}
.nx-voice-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.nx-voice-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 4px;
  line-height: 1.5;
}
.nx-voice-select,
.nx-voice-input {
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.nx-voice-select:focus,
.nx-voice-input:focus {
  border-color: var(--accent-primary);
}
.nx-voice-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nx-voice-slider-row input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-tertiary);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.nx-voice-slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  border: 2px solid var(--bg-secondary);
  box-shadow: 0 0 6px var(--accent-glow);
}
.nx-voice-slider-row input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  border: 2px solid var(--bg-secondary);
}
.nx-voice-slider-value {
  min-width: 40px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent-secondary);
  text-align: right;
}
.nx-voice-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.nx-voice-toggle:last-child {
  border-bottom: none;
}
.nx-voice-toggle-label {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}
.nx-voice-toggle-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
.nx-voice-switch {
  width: 36px;
  height: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.nx-voice-switch::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: transform 0.2s, background 0.2s;
}
.nx-voice-switch.on {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}
.nx-voice-switch.on::after {
  transform: translateX(16px);
  background: #fff;
}
.nx-voice-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.nx-voice-footer .nx-action-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.nx-voice-footer .nx-action-btn:hover {
  background: var(--bg-hover);
}
.nx-voice-footer .nx-action-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}
.nx-voice-footer .nx-action-btn.primary:hover {
  background: var(--accent-secondary);
}

/* Not-supported banner */
.nx-voice-unsupported {
  padding: 10px 14px;
  background: rgba(225, 112, 85, 0.1);
  border: 1px solid rgba(225, 112, 85, 0.4);
  border-radius: 8px;
  font-size: 12px;
  color: var(--danger);
  line-height: 1.5;
  margin-bottom: 16px;
}

@media (max-width: 700px) {
  .nx-voice-overlay { padding: 12px; }
  .nx-voice-modal { max-height: 92vh; }
  .nx-tts-toolbar { bottom: 80px; right: 12px; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-voice-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     READY
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  /* ============================================================
     STORAGE
     ============================================================ */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.assign(state.settings, parsed);
        }
      }
    } catch (e) {
      console.warn('Voice: load failed:', e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (e) {
      console.warn('Voice: save failed:', e);
    }
  }

  /* ============================================================
     SUPPORT DETECTION
     ============================================================ */
  function detectSupport() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognizerSupported = !!SR;
    state.synthesizerSupported = !!window.speechSynthesis;
  }

  /* ============================================================
     DOM: MIC BUTTON
     ============================================================ */
  function mountMicButton() {
    const wrapper = document.querySelector('.input-wrapper');
    if (!wrapper) return;
    if (wrapper.querySelector('.nx-mic-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nx-mic-btn';
    btn.id = 'nxMicBtn';
    btn.title = state.recognizerSupported
      ? 'Voice input (speech recognition)'
      : 'Voice input not supported by this browser';
    btn.setAttribute('aria-label', 'Voice input');
    btn.disabled = !state.recognizerSupported;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="6" y="2" width="4" height="8" rx="2"/>
        <path d="M4 8a4 4 0 008 0"/>
        <path d="M8 12v2M6 14h4"/>
      </svg>`;

    btn.addEventListener('click', toggleListening);

    // Insert before the send button
    const sendBtn = wrapper.querySelector('#sendBtn');
    if (sendBtn) wrapper.insertBefore(btn, sendBtn);
    else wrapper.appendChild(btn);
  }

  /* ============================================================
     DOM: INTERIM BUBBLE
     ============================================================ */
  function showInterimBubble(text) {
    if (!state.settings.showInterim) return;
    const wrapper = document.querySelector('.input-wrapper');
    if (!wrapper) return;
    let bubble = document.getElementById('nxInterimBubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'nx-interim-bubble';
      bubble.id = 'nxInterimBubble';
      bubble.innerHTML = `
        <div class="dots"><span></span><span></span><span></span></div>
        <div class="text"></div>`;
      wrapper.appendChild(bubble);
    }
    const textEl = bubble.querySelector('.text');
    if (textEl) textEl.textContent = text || '…';
  }

  function hideInterimBubble() {
    const bubble = document.getElementById('nxInterimBubble');
    if (bubble) bubble.remove();
  }

  /* ============================================================
     SPEECH RECOGNITION
     ============================================================ */
  function initRecognition() {
    if (!state.recognizerSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();

    recognition.continuous = state.settings.continuous;
    recognition.interimResults = true;
    recognition.lang = state.settings.language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.isListening = true;
      state.isRecognizerStarted = true;
      state.interimTranscript = '';
      state.finalTranscript = '';
      state.errorCount = 0;
      updateMicButton();
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        state.finalTranscript += final;
        appendTranscriptToInput(final);
      }
      state.interimTranscript = interim;
      if (interim) {
        showInterimBubble(interim);
      } else if (!state.finalTranscript) {
        showInterimBubble('…');
      }
    };

    recognition.onerror = (event) => {
      state.errorCount++;
      const errMap = {
        'no-speech': 'No speech detected. Try again.',
        'audio-capture': 'No microphone found. Check your device.',
        'not-allowed': 'Microphone permission denied.',
        'service-not-allowed': 'Speech service blocked.',
        'network': 'Network error in speech service.',
        'aborted': null, // ignore — user-triggered
        'language-not-supported': `Language "${state.settings.language}" not supported by your browser.`,
      };
      const msg = errMap[event.error];
      if (msg === undefined) {
        console.warn('Speech recognition error:', event.error);
      } else if (msg !== null) {
        window.__nexus.showToast(msg, 'error', 3500);
      }
      // Auto-stop on fatal errors
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        state.restartOnEnd = false;
        stopListening();
      }
    };

    recognition.onend = () => {
      state.isRecognizerStarted = false;
      // If restart flag is set (continuous mode), restart
      if (state.restartOnEnd && state.settings.continuous) {
        try {
          recognition.lang = state.settings.language;
          recognition.continuous = state.settings.continuous;
          recognition.start();
          return;
        } catch (e) {
          console.debug('Recognition restart failed:', e);
        }
      }
      state.isListening = false;
      state.restartOnEnd = false;
      updateMicButton();
      hideInterimBubble();

      // Auto-send if configured and something was captured
      if (state.settings.autoSend && state.finalTranscript.trim()) {
        const finalText = state.finalTranscript.trim();
        state.finalTranscript = '';
        setTimeout(() => {
          if (window.__nexus && window.__nexus.sendMessage) {
            const input = document.getElementById('chatInput');
            if (input) {
              input.value = finalText;
              window.__nexus.sendMessage();
            }
          }
        }, 180);
      }
    };

    state.recognition = recognition;
  }

  function startListening() {
    if (!state.recognizerSupported) {
      window.__nexus.showToast('Speech recognition not supported in this browser.', 'error', 3500);
      return;
    }
    if (state.isListening) return;
    if (!state.recognition) initRecognition();

    try {
      state.recognition.lang = state.settings.language;
      state.recognition.continuous = state.settings.continuous;
      state.recognition.start();
      state.restartOnEnd = state.settings.continuous;
      // Button visual update happens in onstart
      updateMicButton();
    } catch (err) {
      // Sometimes calling start() twice throws; treat as recoverable
      if (err.name === 'InvalidStateError') {
        state.isListening = true;
        updateMicButton();
      } else {
        window.__nexus.showToast('Cannot start recognition: ' + err.message, 'error', 3500);
      }
    }
  }

  function stopListening() {
    state.restartOnEnd = false;
    if (state.recognition) {
      try { state.recognition.stop(); }
      catch (e) { /* ignore */ }
    }
    state.isListening = false;
    updateMicButton();
    hideInterimBubble();
  }

  function toggleListening() {
    if (state.isListening) stopListening();
    else startListening();
  }

  function appendTranscriptToInput(text) {
    const input = document.getElementById('chatInput');
    if (!input) return;
    // Append, with a space separator if needed
    const current = input.value;
    let next;
    if (!current) next = text;
    else if (/[\s\n]$/.test(current)) next = current + text;
    else next = current + ' ' + text;
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Focus and resize
    try { input.focus(); } catch (e) {}
  }

  function updateMicButton() {
    const btn = document.getElementById('nxMicBtn');
    if (!btn) return;
    btn.classList.toggle('listening', state.isListening);
    if (state.isListening) {
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="6" y="2" width="4" height="8" rx="2"/>
          <path d="M4 8a4 4 0 008 0"/>
          <path d="M8 12v2M6 14h4"/>
        </svg>
        <span class="nx-mic-dot"></span>`;
      btn.title = 'Listening… click to stop';
    } else {
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="6" y="2" width="4" height="8" rx="2"/>
          <path d="M4 8a4 4 0 008 0"/>
          <path d="M8 12v2M6 14h4"/>
        </svg>`;
      btn.title = state.recognizerSupported
        ? 'Voice input (speech recognition)'
        : 'Voice input not supported';
    }
  }

  /* ============================================================
     TEXT-TO-SPEECH
     ============================================================ */
  function loadVoices() {
    if (!state.synthesizerSupported) return;
    const tryLoad = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) {
        state.ttsVoices = voices;
        // Pick default voice if none set
        if (!state.settings.ttsVoiceURI && voices.length) {
          const match = voices.find(v => v.lang === state.settings.language) || voices[0];
          if (match) state.settings.ttsVoiceURI = match.voiceURI;
        }
      }
    };
    tryLoad();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = tryLoad;
    }
  }

  function pickVoice() {
    if (!state.synthesizerSupported) return null;
    const uri = state.settings.ttsVoiceURI;
    if (uri) {
      const v = state.ttsVoices.find(x => x.voiceURI === uri);
      if (v) return v;
    }
    // Fallback to language match or first
    const langMatch = state.ttsVoices.find(v => v.lang === state.settings.language);
    if (langMatch) return langMatch;
    return state.ttsVoices[0] || null;
  }

  function chunkText(text) {
    if (!text) return [];
    // Split on sentence boundaries; chunk lengths around TTS_CHUNK_MAX
    const sentenceSplit = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/);
    const chunks = [];
    let buf = '';
    for (const s of sentenceSplit) {
      if (!s) continue;
      if ((buf + ' ' + s).trim().length > TTS_CHUNK_MAX && buf) {
        chunks.push(buf.trim());
        buf = s;
      } else {
        buf = (buf ? buf + ' ' : '') + s;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
    return chunks;
  }

  function updateTtsToolbar() {
    let toolbar = document.getElementById('nxTtsToolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'nx-tts-toolbar';
      toolbar.id = 'nxTtsToolbar';
      toolbar.innerHTML = `
        <button class="nx-tts-toolbar-btn primary" id="nxTtsPauseBtn" title="Pause">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="3" y="2" width="3" height="10" rx="0.5"/>
            <rect x="8" y="2" width="3" height="10" rx="0.5"/>
          </svg>
        </button>
        <button class="nx-tts-toolbar-btn" id="nxTtsStopBtn" title="Stop">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="3" y="3" width="8" height="8" rx="1"/>
          </svg>
        </button>
        <div class="nx-tts-toolbar-info" id="nxTtsInfo">— / —</div>`;
      document.body.appendChild(toolbar);

      toolbar.querySelector('#nxTtsPauseBtn').addEventListener('click', () => {
        if (state.isPaused) resumeSpeaking();
        else pauseSpeaking();
      });
      toolbar.querySelector('#nxTtsStopBtn').addEventListener('click', () => {
        stopSpeaking();
      });
    }

    if (state.isSpeaking) {
      toolbar.classList.add('open');
    } else {
      toolbar.classList.remove('open');
    }

    const info = toolbar.querySelector('#nxTtsInfo');
    if (info) {
      if (state.isSpeaking && state.currentChunks.length) {
        info.textContent = `${state.currentChunkIdx + 1} / ${state.currentChunks.length}`;
      } else {
        info.textContent = '— / —';
      }
    }

    const pauseBtn = toolbar.querySelector('#nxTtsPauseBtn');
    if (pauseBtn) {
      if (state.isPaused) {
        pauseBtn.title = 'Resume';
        pauseBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 2l9 5-9 5V2z"/>
          </svg>`;
      } else {
        pauseBtn.title = 'Pause';
        pauseBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="3" y="2" width="3" height="10" rx="0.5"/>
            <rect x="8" y="2" width="3" height="10" rx="0.5"/>
          </svg>`;
      }
    }
  }

  function markMessageTtsState(btn, mode) {
    if (!btn) return;
    btn.classList.remove('speaking', 'paused');
    if (mode === 'speaking') {
      btn.classList.add('speaking');
      btn.innerHTML = '🔊 Speaking';
    } else if (mode === 'paused') {
      btn.classList.add('paused');
      btn.innerHTML = '⏸ Paused';
    } else {
      btn.innerHTML = '🔊 Speak';
    }
  }

  function speak(text, opts = {}) {
    if (!state.synthesizerSupported) {
      window.__nexus.showToast('Text-to-speech not supported.', 'error', 3000);
      return;
    }
    if (!text || !String(text).trim()) return;

    // Stop any current speech
    stopSpeaking({ silent: true });

    const chunks = chunkText(String(text));
    if (!chunks.length) return;

    state.currentChunks = chunks;
    state.currentChunkIdx = 0;
    state.isSpeaking = true;
    state.isPaused = false;

    // Find initiating message button if provided
    const sourceBtn = opts.buttonEl || null;

    const speakNext = () => {
      if (state.currentChunkIdx >= state.currentChunks.length) {
        // Done
        state.isSpeaking = false;
        state.isPaused = false;
        state.currentUtterance = null;
        state.currentChunks = [];
        state.currentChunkIdx = 0;
        markMessageTtsState(sourceBtn, 'idle');
        updateTtsToolbar();
        return;
      }
      const chunk = state.currentChunks[state.currentChunkIdx];
      const utter = new SpeechSynthesisUtterance(chunk);
      const voice = pickVoice();
      if (voice) utter.voice = voice;
      utter.lang = state.settings.language;
      utter.rate = state.settings.ttsRate;
      utter.pitch = state.settings.ttsPitch;
      utter.volume = state.settings.ttsVolume;

      utter.onstart = () => {
        if (sourceBtn) markMessageTtsState(sourceBtn, 'speaking');
        updateTtsToolbar();
      };
      utter.onend = () => {
        if (state.isPaused) {
          // Paused mid-chunk; will resume from same chunk
          return;
        }
        state.currentChunkIdx++;
        speakNext();
      };
      utter.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        console.warn('TTS error:', event.error);
        state.currentChunkIdx++;
        speakNext();
      };

      state.currentUtterance = utter;
      try {
        window.speechSynthesis.speak(utter);
      } catch (err) {
        console.warn('TTS speak failed:', err);
        state.isSpeaking = false;
        updateTtsToolbar();
      }
    };

    speakNext();
    updateTtsToolbar();
  }

  function stopSpeaking(opts = {}) {
    if (!state.synthesizerSupported) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    state.isSpeaking = false;
    state.isPaused = false;
    state.currentUtterance = null;
    state.currentChunks = [];
    state.currentChunkIdx = 0;
    updateTtsToolbar();
    // Reset all message buttons
    document.querySelectorAll('.nx-tts-btn').forEach(btn => {
      markMessageTtsState(btn, 'idle');
    });
    if (!opts.silent) {
      // no toast — this is expected behavior
    }
  }

  function pauseSpeaking() {
    if (!state.synthesizerSupported) return;
    if (!state.isSpeaking) return;
    try {
      window.speechSynthesis.pause();
      state.isPaused = true;
      updateTtsToolbar();
      document.querySelectorAll('.nx-tts-btn.speaking').forEach(btn => {
        markMessageTtsState(btn, 'paused');
      });
    } catch (e) {
      console.warn('TTS pause failed:', e);
    }
  }

  function resumeSpeaking() {
    if (!state.synthesizerSupported) return;
    try {
      window.speechSynthesis.resume();
      state.isPaused = false;
      updateTtsToolbar();
      document.querySelectorAll('.nx-tts-btn.paused').forEach(btn => {
        markMessageTtsState(btn, 'speaking');
      });
    } catch (e) {
      console.warn('TTS resume failed:', e);
    }
  }

  /* ============================================================
     DOM: TTS BUTTONS ON MESSAGES
     ============================================================ */
  function decorateMessageWithTts(wrapper, msg, index, chat) {
    if (!state.synthesizerSupported) return;
    if (msg.role !== 'assistant') return;
    if (!msg.content || msg.streaming) return;
    if (wrapper.querySelector('.nx-tts-btn')) return;

    const body = wrapper.querySelector('.message-body');
    if (!body) return;

    const btn = document.createElement('button');
    btn.className = 'nx-tts-btn';
    btn.type = 'button';
    btn.title = 'Read this message aloud';
    btn.innerHTML = '🔊 Speak';
    btn.addEventListener('click', () => {
      if (state.isSpeaking) {
        // Toggle stop
        stopSpeaking();
        return;
      }
      speak(msg.content, { buttonEl: btn });
    });

    body.appendChild(btn);
  }

  function hookMessages() {
    if (!window.__nexus || !window.__nexus.hooks) return;
    const hooks = window.__nexus.hooks;
    if (!Array.isArray(hooks.afterMessageElement)) return;
    if (hooks.afterMessageElement.__voice_hooked__) return;

    hooks.afterMessageElement.push(decorateMessageWithTts);
    hooks.afterMessageElement.__voice_hooked__ = true;

    // Re-render to apply to existing messages
    if (window.__nexus.state.activeChatId) {
      window.__nexus.renderActiveChat();
    }
  }

  /* ============================================================
     SETTINGS MODAL
     ============================================================ */
  function buildSettingsModal() {
    const overlay = document.createElement('div');
    overlay.className = 'nx-voice-overlay';
    overlay.id = 'nxVoiceOverlay';
    overlay.innerHTML = `
      <div class="nx-voice-modal" role="dialog" aria-modal="true" aria-label="Voice settings">
        <div class="nx-voice-header">
          <span>🎙️ Voice & Speech</span>
          <button class="modal-close" id="nxVoiceClose" aria-label="Close">×</button>
        </div>
        <div class="nx-voice-body" id="nxVoiceBody"></div>
        <div class="nx-voice-footer">
          <button class="nx-action-btn" id="nxVoiceReset">Reset</button>
          <button class="nx-action-btn primary" id="nxVoiceDone">Done</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) closeSettings();
    });
    overlay.querySelector('#nxVoiceClose').addEventListener('click', closeSettings);
    overlay.querySelector('#nxVoiceDone').addEventListener('click', closeSettings);
    overlay.querySelector('#nxVoiceReset').addEventListener('click', () => {
      if (!confirm('Reset voice settings to defaults?')) return;
      state.settings = {
        language: 'en-US',
        autoSend: false,
        showInterim: true,
        continuous: false,
        autoStopOnSilence: true,
        ttsEnabled: true,
        ttsVoiceURI: '',
        ttsRate: 1.0,
        ttsPitch: 1.0,
        ttsVolume: 1.0,
        ttsAutoSpeak: false,
      };
      save();
      renderSettingsBody();
      if (state.recognition) {
        state.recognition.lang = state.settings.language;
      }
      window.__nexus.showToast('Voice settings reset', 'success', 2000);
    });
  }

  function renderSettingsBody() {
    const body = document.getElementById('nxVoiceBody');
    if (!body) return;
    body.innerHTML = '';

    // Support warnings
    if (!state.recognizerSupported) {
      const warn = document.createElement('div');
      warn.className = 'nx-voice-unsupported';
      warn.textContent = '⚠️ Speech recognition is not supported by this browser. Try Chrome, Edge, or Safari.';
      body.appendChild(warn);
    }
    if (!state.synthesizerSupported) {
      const warn = document.createElement('div');
      warn.className = 'nx-voice-unsupported';
      warn.textContent = '⚠️ Text-to-speech is not supported by this browser.';
      body.appendChild(warn);
    }

    // ---------- SPEECH INPUT ----------
    const inputSection = document.createElement('div');
    inputSection.innerHTML = `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:12px;">Speech input</div>`;

    // Language
    const langField = document.createElement('div');
    langField.className = 'nx-voice-field';
    const langSelect = document.createElement('select');
    langSelect.className = 'nx-voice-select';
    for (const lang of SUPPORTED_LANGUAGES) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = `${lang.label} (${lang.code})`;
      if (lang.code === state.settings.language) opt.selected = true;
      langSelect.appendChild(opt);
    }
    langSelect.addEventListener('change', () => {
      state.settings.language = langSelect.value;
      save();
      if (state.recognition) state.recognition.lang = state.settings.language;
    });
    langField.innerHTML = `<label class="nx-voice-label">Recognition language</label>`;
    langField.appendChild(langSelect);
    langField.insertAdjacentHTML('beforeend', `<div class="nx-voice-hint">Language the recognizer expects. Default is English (US).</div>`);
    inputSection.appendChild(langField);

    // Toggles
    inputSection.appendChild(makeToggle(
      'Continuous mode',
      'Keep listening after a pause until manually stopped',
      'continuous',
      (val) => {
        state.settings.continuous = val;
        if (state.recognition) state.recognition.continuous = val;
      }
    ));
    inputSection.appendChild(makeToggle(
      'Auto-send after speech',
      'Automatically send the message when you stop speaking',
      'autoSend',
    ));
    inputSection.appendChild(makeToggle(
      'Show live transcript',
      'Display a bubble with the interim transcript while listening',
      'showInterim',
    ));

    body.appendChild(inputSection);

    // ---------- SPEECH OUTPUT ----------
    const outputSection = document.createElement('div');
    outputSection.style.marginTop = '24px';
    outputSection.innerHTML = `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:12px;">Speech output</div>`;

    // Voice select
    const voiceField = document.createElement('div');
    voiceField.className = 'nx-voice-field';
    const voiceSelect = document.createElement('select');
    voiceSelect.className = 'nx-voice-select';
    if (!state.ttsVoices.length) {
      const opt = document.createElement('option');
      opt.textContent = 'Loading voices…';
      voiceSelect.appendChild(opt);
    } else {
      const sorted = [...state.ttsVoices].sort((a, b) => {
        const langA = a.lang || '';
        const langB = b.lang || '';
        if (langA !== langB) return langA.localeCompare(langB);
        return (a.name || '').localeCompare(b.name || '');
      });
      for (const v of sorted) {
        const opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        if (v.voiceURI === state.settings.ttsVoiceURI) opt.selected = true;
        voiceSelect.appendChild(opt);
      }
    }
    voiceSelect.addEventListener('change', () => {
      state.settings.ttsVoiceURI = voiceSelect.value;
      save();
    });
    voiceField.innerHTML = `<label class="nx-voice-label">Voice</label>`;
    voiceField.appendChild(voiceSelect);
    voiceField.insertAdjacentHTML('beforeend',
      `<div class="nx-voice-hint">Voices available depend on your browser and operating system.</div>`);
    outputSection.appendChild(voiceField);

    // Rate / pitch / volume sliders
    outputSection.appendChild(makeSlider('Rate', 'ttsRate', 0.5, 2.0, 0.05, (v) => v.toFixed(2) + '×'));
    outputSection.appendChild(makeSlider('Pitch', 'ttsPitch', 0.5, 2.0, 0.05, (v) => v.toFixed(2)));
    outputSection.appendChild(makeSlider('Volume', 'ttsVolume', 0, 1.0, 0.05, (v) => Math.round(v * 100) + '%'));

    // Test button
    const testRow = document.createElement('div');
    testRow.style.marginTop = '10px';
    const testBtn = document.createElement('button');
    testBtn.className = 'nx-action-btn';
    testBtn.textContent = '▶ Test voice';
    testBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;cursor:pointer;';
    testBtn.addEventListener('click', () => {
      speak('This is how the voice will sound. Everything is working.');
    });
    testRow.appendChild(testBtn);
    outputSection.appendChild(testRow);

    body.appendChild(outputSection);
  }

  function makeToggle(label, desc, key, onChange) {
    const row = document.createElement('div');
    row.className = 'nx-voice-toggle';
    row.innerHTML = `
      <div>
        <div class="nx-voice-toggle-label">${label}</div>
        <div class="nx-voice-toggle-desc">${desc}</div>
      </div>
      <div class="nx-voice-switch ${state.settings[key] ? 'on' : ''}" data-key="${key}"></div>`;
    const sw = row.querySelector('.nx-voice-switch');
    sw.addEventListener('click', () => {
      const next = !sw.classList.contains('on');
      sw.classList.toggle('on', next);
      state.settings[key] = next;
      save();
      if (onChange) onChange(next);
    });
    return row;
  }

  function makeSlider(label, key, min, max, step, format) {
    const wrap = document.createElement('div');
    wrap.className = 'nx-voice-field';
    const valEl = document.createElement('span');
    valEl.className = 'nx-voice-slider-value';
    valEl.textContent = format(state.settings[key]);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = state.settings[key];
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      state.settings[key] = v;
      valEl.textContent = format(v);
      save();
    });
    const labelWrap = document.createElement('label');
    labelWrap.className = 'nx-voice-label';
    labelWrap.textContent = label;
    wrap.appendChild(labelWrap);
    const row = document.createElement('div');
    row.className = 'nx-voice-slider-row';
    row.appendChild(slider);
    row.appendChild(valEl);
    wrap.appendChild(row);
    return wrap;
  }

  function openSettings() {
    const overlay = document.getElementById('nxVoiceOverlay');
    if (!overlay) {
      buildSettingsModal();
    }
    renderSettingsBody();
    document.getElementById('nxVoiceOverlay').classList.add('open');
  }

  function closeSettings() {
    const overlay = document.getElementById('nxVoiceOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  /* ============================================================
     BOOT
     ============================================================ */
  ready(() => {
    injectStyles();
    detectSupport();
    load();
    mountMicButton();
    initRecognition();
    loadVoices();
    hookMessages();

    // Keyboard shortcut: Ctrl+Shift+M toggles listening
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleListening();
      }
    });

    // Auto-stop speaking when user sends a new message
    if (window.__nexus && window.__nexus.hooks) {
      window.__nexus.hooks.beforeMessageSend.push(() => {
        if (state.isSpeaking) stopSpeaking({ silent: true });
        if (state.isListening) stopListening();
      });
    }

    // Handle voices loading asynchronously
    if (state.synthesizerSupported) {
      const tryLater = () => {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length && !state.ttsVoices.length) {
          state.ttsVoices = v;
          if (!state.settings.ttsVoiceURI) {
            const match = v.find(x => x.lang === state.settings.language) || v[0];
            if (match) state.settings.ttsVoiceURI = match.voiceURI;
          }
        }
      };
      setTimeout(tryLater, 200);
      setTimeout(tryLater, 1000);
    }
  });

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Voice = {
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    openSettings,
    getSettings: () => ({ ...state.settings }),
    isSupported: () => ({
      recognition: state.recognizerSupported,
      synthesis: state.synthesizerSupported,
    }),
    isListening: () => state.isListening,
    isSpeaking: () => state.isSpeaking,
  };
})();
