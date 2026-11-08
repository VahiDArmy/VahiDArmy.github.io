// AURORA OS — Music Player

import { h, $, clear } from '../core/dom.js';
import { PLAYLIST } from '../data/seed.js';
import { button } from '../ui/components.js';

export const meta = {
  id: 'music',
  title: 'Music',
  icon: '♫',
  defaultSize: { width: 800, height: 520 },
};

let _root = null;
let _currentIdx = 0;
let _playing = false;
let _elapsed = 0;
let _interval = null;
let _refs = {};

function fmtDur(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}

function currentTrack() { return PLAYLIST[_currentIdx]; }

function drawWaveform(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  const bars = 64;
  const barW = w / bars;
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue('--accent').trim() || '#7c5cff';
  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    const height = (Math.sin(t * Math.PI * 4) * 0.3 + 0.5 + Math.sin(t * 17) * 0.15) * h * 0.8;
    const played = (i / bars) < (_elapsed / currentTrack().duration);
    ctx.fillStyle = played ? accent : 'rgba(255,255,255,0.1)';
    ctx.fillRect(i * barW + 1, (h - height) / 2, barW - 2, height);
  }
}

function updateUI() {
  if (!_refs.title) return;
  const t = currentTrack();
  _refs.title.textContent = t.title;
  _refs.artist.textContent = t.artist + ' · ' + t.album;
  _refs.elapsed.textContent = fmtDur(_elapsed);
  _refs.total.textContent = fmtDur(t.duration);
  _refs.fill.style.width = (_elapsed / t.duration * 100) + '%';
  _refs.play.textContent = _playing ? '⏸' : '▶';
  if (_refs.canvas) drawWaveform(_refs.canvas);
  for (const [i, row] of (_refs.trackRows || []).entries()) {
    row.classList.toggle('is-active', i === _currentIdx);
  }
}

function play() {
  _playing = true;
  if (_interval) clearInterval(_interval);
  _interval = setInterval(() => {
    _elapsed += 0.25;
    if (_elapsed >= currentTrack().duration) {
      _elapsed = 0;
      next();
    }
    updateUI();
  }, 250);
  updateUI();
}

function pause() {
  _playing = false;
  if (_interval) clearInterval(_interval);
  _interval = null;
  updateUI();
}

function next() {
  _currentIdx = (_currentIdx + 1) % PLAYLIST.length;
  _elapsed = 0;
  if (_playing) play(); else updateUI();
}

function prev() {
  _currentIdx = (_currentIdx - 1 + PLAYLIST.length) % PLAYLIST.length;
  _elapsed = 0;
  if (_playing) play(); else updateUI();
}

function selectTrack(i) {
  _currentIdx = i;
  _elapsed = 0;
  if (!_playing) play(); else updateUI();
}

export function mount(container) {
  clear(container);
  _root = h('div', { class: 'music-wrap' });

  const main = h('div', { class: 'music-main' });
  const cover = h('div', { class: 'music-cover', text: '♫' });
  const info = h('div', { class: 'music-info' });
  _refs.title = h('div', { class: 'music-title' });
  _refs.artist = h('div', { class: 'music-artist' });
  info.append(_refs.title, _refs.artist);

  const canvas = h('canvas', { class: 'music-waveform' });
  _refs.canvas = canvas;

  const prog = h('div', { class: 'music-progress' });
  const bar = h('div', { class: 'music-progress__bar' });
  _refs.fill = h('div', { class: 'music-progress__fill' });
  bar.append(_refs.fill);
  bar.addEventListener('click', (e) => {
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    _elapsed = pct * currentTrack().duration;
    updateUI();
  });
  const times = h('div', { class: 'music-progress__times' });
  _refs.elapsed = h('span', { text: '0:00' });
  _refs.total = h('span', { text: '0:00' });
  times.append(_refs.elapsed, _refs.total);
  prog.append(bar, times);

  const controls = h('div', { class: 'music-controls' });
  const prevBtn = h('button', { class: 'music-ctrl', type: 'button', text: '⏮', onClick: prev });
  _refs.play = h('button', { class: 'music-ctrl music-ctrl--play', type: 'button', text: '▶' });
  _refs.play.addEventListener('click', () => _playing ? pause() : play());
  const nextBtn = h('button', { class: 'music-ctrl', type: 'button', text: '⏭', onClick: next });
  controls.append(prevBtn, _refs.play, nextBtn);

  main.append(cover, info, canvas, prog, controls);

  const playlist = h('div', { class: 'music-playlist' });
  playlist.append(h('div', { class: 'music-playlist__head', text: 'Playlist · ' + PLAYLIST.length + ' tracks' }));
  _refs.trackRows = [];
  PLAYLIST.forEach((t, i) => {
    const row = h('div', { class: 'music-track' });
    row.append(h('span', { class: 'music-track__num', text: String(i + 1) }));
    const body = h('div', { class: 'music-track__body' });
    body.append(h('div', { class: 'music-track__title', text: t.title }));
    body.append(h('div', { class: 'music-track__artist', text: t.artist }));
    row.append(body, h('span', { class: 'music-track__dur', text: fmtDur(t.duration) }));
    row.addEventListener('click', () => selectTrack(i));
    _refs.trackRows.push(row);
    playlist.append(row);
  });

  _root.append(main, playlist);
  container.append(_root);

  updateUI();
  setTimeout(() => drawWaveform(canvas), 100);
  window.addEventListener('resize', () => drawWaveform(canvas));

  return () => { if (_interval) clearInterval(_interval); };
}

export default { meta, mount };
