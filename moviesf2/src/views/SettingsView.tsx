/** Settings: the booth key, the beam, and the shape of the room. */

import { useEffect, useState } from 'react';
import {
  Check,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Palette,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { navigate } from '../app/router';
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  THEMES,
  clearApiKey,
  getApiKey,
  getSettings,
  hasApiKey,
  maskKey,
  setApiKey,
  updateSettings,
  useSettings,
} from '../data/settings';
import { syncCatalogue, useModelCatalogue, syncError, syncTimestamp, getCatalogue } from '../ai/models';
import { clearDb, exportDatabase, resetDb, storageFootprint, useDb } from '../data/store';
import { download } from '../lib/utils';
import { bytesLabel, dateTime, n } from '../lib/format-extra';
import { ModelPicker } from '../components/ModelPicker';
import {
  Button,
  Chip,
  Field,
  Input,
  Notice,
  Select,
  Slider,
  Stat,
  Tabs,
  Textarea,
  Toggle,
  Tooltip,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

export function SettingsView() {
  const db = useDb();
  const settings = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const models = useModelCatalogue();
  const initialTab = (new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') as string) || 'appearance';
  const [tab, setTab] = useState(initialTab === 'ai' ? 'booth' : initialTab);
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [paramsDraft, setParamsDraft] = useState(settings.params);
  useEffect(() => setParamsDraft(settings.params), [settings.params]);

  const existingKey = getApiKey();

  const saveKey = () => {
    const value = keyDraft.trim();
    if (!value) return;
    setApiKey(value, settings.rememberKey);
    setKeyDraft('');
    toast.push({ tone: 'success', title: 'Key stored', body: settings.rememberKey ? 'In this browser’s localStorage.' : 'For this tab only (sessionStorage).' });
  };

  const testConnection = async () => {
    const key = getApiKey();
    if (!key) {
      toast.push({ tone: 'error', title: 'No key to test' });
      return;
    }
    setTesting(true);
    try {
      const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} ${response.statusText} · ${text.slice(0, 160)}`);
      }
      const data = (await response.json()) as { data?: unknown[] };
      toast.push({ tone: 'success', title: 'Provider reachable', body: `${data.data?.length || 0} models visible to this key.` });
    } catch (error) {
      toast.push({ tone: 'error', title: 'Connection failed', body: (error as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const syncModels = async () => {
    setSyncing(true);
    const outcome = await syncCatalogue({ freeOnly: false });
    setSyncing(false);
    toast.push({ tone: outcome.ok ? 'success' : 'error', title: outcome.ok ? 'Catalogue synced' : 'Sync failed', body: outcome.message });
  };

  const tabContent = () => {
    if (tab === 'appearance') {
      return (
        <div className="settings-stack">
          <section className="card card--pad">
            <div className="panel-title"><Palette size={11} /> Theme</div>
            <div className="theme-grid">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  className={cx('theme-card', settings.theme === theme.id && 'is-active')}
                  onClick={() => updateSettings({ theme: theme.id })}
                >
                  <span className="theme-card__swatch">
                    {theme.swatch.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className="theme-card__name">{theme.name}</span>
                  <span className="theme-card__note">{theme.note}</span>
                  {settings.theme === theme.id && <Check size={13} className="theme-card__check" />}
                </button>
              ))}
            </div>
          </section>

          <section className="card card--pad">
            <div className="panel-title">Accent</div>
            <div className="accent-row">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.id}
                  className={cx('accent-dot', settings.accent === accent.hex && 'is-active')}
                  style={{ background: accent.hex }}
                  onClick={() => updateSettings({ accent: accent.hex })}
                  title={accent.name}
                  aria-label={accent.name}
                />
              ))}
              <label className="accent-custom">
                <input
                  type="color"
                  value={settings.accent}
                  onChange={(event) => updateSettings({ accent: event.target.value })}
                />
                <span className="mono">custom</span>
              </label>
            </div>
          </section>

          <section className="card card--pad">
            <div className="panel-title">Density &amp; type</div>
            <div className="cols-2">
              <Field label="Density">
                <Select value={settings.density} onChange={(event) => updateSettings({ density: event.target.value as never })}>
                  <option value="compact">compact</option>
                  <option value="comfortable">comfortable</option>
                  <option value="roomy">roomy</option>
                </Select>
              </Field>
              <Field label="Font scale" meta={`${Math.round(settings.fontScale * 100)}%`}>
                <Slider
                  label="Font scale"
                  value={settings.fontScale}
                  min={0.88}
                  max={1.2}
                  step={0.02}
                  display={`${Math.round(settings.fontScale * 100)}%`}
                  onChange={(value) => updateSettings({ fontScale: value })}
                />
              </Field>
            </div>
            <div className="stack" style={{ marginTop: 10 }}>
              <Toggle checked={settings.motion} onChange={(motion) => updateSettings({ motion })} label="Interface motion" />
              <Toggle checked={settings.sidebarCollapsed} onChange={(sidebarCollapsed) => updateSettings({ sidebarCollapsed })} label="Collapse the rail on load" />
            </div>
          </section>
        </div>
      );
    }

    if (tab === 'booth') {
      return (
        <div className="settings-stack">
          <section className="card card--pad">
            <div className="panel-title"><KeyRound size={11} /> Provider key</div>
            <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.7, maxWidth: 640 }}>
              Requests go from this browser straight to the provider you configure. There is no proxy and no server. The
              key is never written to the database, an export or a log.
            </p>
            <div className="key-row">
              <div className="key-field">
                <span className="mono">{existingKey ? maskKey(existingKey) : 'no key stored'}</span>
                <Chip sm mono tone={hasApiKey() ? 'accent' : 'hate'}>{hasApiKey() ? 'armed' : 'empty'}</Chip>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <Tooltip tip={showKey ? 'Hide new key' : 'Show new key'}>
                  <button className="icon-btn icon-btn--sm" onClick={() => setShowKey((value) => !value)} aria-label="Toggle key visibility">
                    {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </Tooltip>
                <Button size="sm" variant="ghost" icon={<Trash2 size={11} />} onClick={() => { clearApiKey(); toast.push({ tone: 'warn', title: 'Key removed' }); }}>
                  Forget
                </Button>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Field label="New key" hint="sk-or-… stays in this browser">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={keyDraft}
                    onChange={(event) => setKeyDraft(event.target.value)}
                    placeholder="Paste a provider key"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
              </div>
              <Button variant="primary" onClick={saveKey} disabled={!keyDraft.trim()}>Store key</Button>
              <Button variant="outline" onClick={testConnection} disabled={testing}>{testing ? 'Testing…' : 'Test'}</Button>
            </div>
            <div className="stack" style={{ marginTop: 10 }}>
              <Toggle checked={settings.rememberKey} onChange={(rememberKey) => updateSettings({ rememberKey })} label="Remember across sessions" />
            </div>
            <Notice tone="accent" icon={<ShieldCheck size={13} />}>
              OpenRouter keys can be scoped and rate-limited. Use a dedicated key for browser use, and never reuse a
              server secret here.
            </Notice>
          </section>

          <section className="card card--pad">
            <div className="panel-title"><Sparkles size={11} /> Provider</div>
            <div className="cols-2">
              <Field label="Provider mode">
                <Select value={settings.provider} onChange={(event) => updateSettings({ provider: event.target.value as never })}>
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai-compatible">OpenAI-compatible endpoint</option>
                </Select>
              </Field>
              <Field label="Base URL" hint="must allow browser CORS">
                <Input value={settings.baseUrl} onChange={(event) => updateSettings({ baseUrl: event.target.value })} />
              </Field>
            </div>
            <Field label="Default model">
              <ModelPicker value={settings.defaultModel} onChange={(defaultModel) => updateSettings({ defaultModel })} />
            </Field>
            <div className="row row--between" style={{ marginTop: 8 }}>
              <span className="faint" style={{ fontSize: 9 }}>
                {models.length} models in the catalogue · synced {syncTimestamp() ? dateTime(syncTimestamp()) : 'never'}
                {syncError() ? ` · ${syncError()}` : ''}
              </span>
              <Button size="sm" variant="ghost" icon={<RotateCcw size={11} />} onClick={syncModels} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync catalogue'}
              </Button>
            </div>
            <Chip mono sm>{getCatalogue().filter((model) => model.isFree).length} free-tier models</Chip>
          </section>

          <section className="card card--pad">
            <div className="panel-title"><SlidersHorizontal size={11} /> Default generation</div>
            <div className="cols-2">
              <Slider label="Temperature" value={paramsDraft.temperature} min={0} max={2} step={0.05} display={paramsDraft.temperature.toFixed(2)} onChange={(temperature) => { const next = { ...paramsDraft, temperature }; setParamsDraft(next); updateSettings({ params: next }); }} />
              <Slider label="Top-p" value={paramsDraft.top_p} min={0.1} max={1} step={0.05} display={paramsDraft.top_p.toFixed(2)} onChange={(top_p) => { const next = { ...paramsDraft, top_p }; setParamsDraft(next); updateSettings({ params: next }); }} />
              <Slider label="Frequency penalty" value={paramsDraft.frequency_penalty} min={0} max={2} step={0.1} display={paramsDraft.frequency_penalty.toFixed(1)} onChange={(frequency_penalty) => { const next = { ...paramsDraft, frequency_penalty }; setParamsDraft(next); updateSettings({ params: next }); }} />
              <Slider label="Presence penalty" value={paramsDraft.presence_penalty} min={0} max={2} step={0.1} display={paramsDraft.presence_penalty.toFixed(1)} onChange={(presence_penalty) => { const next = { ...paramsDraft, presence_penalty }; setParamsDraft(next); updateSettings({ params: next }); }} />
            </div>
            <div className="stack" style={{ marginTop: 8 }}>
              <Toggle checked={paramsDraft.stream} onChange={(stream) => { const next = { ...paramsDraft, stream }; setParamsDraft(next); updateSettings({ params: next }); }} label="Stream every request" />
              <Toggle checked={paramsDraft.reasoning} onChange={(reasoning) => { const next = { ...paramsDraft, reasoning }; setParamsDraft(next); updateSettings({ params: next }); }} label="Ask for internal thinking when supported" />
              <Toggle checked={settings.showReasoning} onChange={(showReasoning) => updateSettings({ showReasoning })} label="Show reasoning panels" />
              <Toggle checked={settings.reasoningExpanded} onChange={(reasoningExpanded) => updateSettings({ reasoningExpanded })} label="Expand reasoning by default" />
              <Toggle checked={settings.streamPersist} onChange={(streamPersist) => updateSettings({ streamPersist })} label="Persist streaming text" />
              <Toggle checked={settings.autoTitle} onChange={(autoTitle) => updateSettings({ autoTitle })} label="Auto-title new threads" />
            </div>
          </section>

          <section className="card card--pad">
            <div className="panel-title"><Wand2 size={11} /> Default system instruction</div>
            <Textarea
              className="textarea--tall"
              value={settings.systemPrompt}
              onChange={(event) => updateSettings({ systemPrompt: event.target.value })}
            />
            <Button size="sm" variant="ghost" icon={<RotateCcw size={11} />} style={{ marginTop: 8 }} onClick={() => updateSettings({ systemPrompt: DEFAULT_SETTINGS.systemPrompt })}>
              Restore default
            </Button>
          </section>
        </div>
      );
    }

    if (tab === 'data') {
      return (
        <div className="settings-stack">
          <section className="card card--pad">
            <div className="panel-title"><Database size={11} /> Local store</div>
            <div className="cols-3">
              <Stat label="Titles" value={n(db.cinema_titles.length)} />
              <Stat label="Sessions" value={n(db.cinema_watch_sessions.length)} />
              <Stat label="AI turns" value={n(db.cinema_ai_turns.length)} />
            </div>
            <div className="row row--between" style={{ marginTop: 12 }}>
              <span className="mono faint" style={{ fontSize: 9 }}>footprint {bytesLabel(storageFootprint())} · localStorage</span>
              <div className="row" style={{ gap: 4 }}>
                <Button size="sm" variant="outline" onClick={() => download('full-metal-cinema.json', exportDatabase(), 'application/json')}>Export JSON</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate('imports')}>Import</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate('data')}>Data lab</Button>
              </div>
            </div>
          </section>

          <section className="card card--pad">
            <div className="panel-title">Reset</div>
            <div className="cols-2">
              <div>
                <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Reseed rebuilds the bundled shelf, including its ratings, sessions and seeded thread.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<RotateCcw size={11} />}
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    const ok = await confirm({ title: 'Reseed the database?', body: 'Current changes are discarded.', confirmLabel: 'Reseed', danger: true });
                    if (ok) {
                      resetDb();
                      toast.push({ tone: 'warn', title: 'Reseeded' });
                    }
                  }}
                >
                  Reset to seed
                </Button>
              </div>
              <div>
                <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Clear empties every table. Export first if there is anything you would miss.
                </p>
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={11} />}
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    const ok = await confirm({ title: 'Clear every table?', body: 'This removes the shelf and all threads.', confirmLabel: 'Clear everything', danger: true });
                    if (ok) {
                      clearDb();
                      toast.push({ tone: 'warn', title: 'Cleared' });
                    }
                  }}
                >
                  Clear everything
                </Button>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div className="card__title">Recent activity</div>
              <Chip mono sm>{db.cinema_activity.length} events</Chip>
            </div>
            <div className="table-wrap" style={{ border: 0, maxHeight: 320 }}>
              <table className="table table--sm">
                <thead>
                  <tr><th>When</th><th>Action</th><th>Entity</th><th>Detail</th></tr>
                </thead>
                <tbody>
                  {[...db.cinema_activity]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 40)
                    .map((row) => (
                      <tr key={row.id}>
                        <td className="mono" style={{ fontSize: 8.5 }}>{dateTime(row.created_at)}</td>
                        <td><Chip sm mono>{row.action}</Chip></td>
                        <td className="mono" style={{ fontSize: 8.5 }}>{row.entity || '—'}</td>
                        <td style={{ fontSize: 'var(--fs-2xs)' }}>{row.detail || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="settings-stack">
        <section className="card card--pad">
          <div className="panel-title">Full Metal Cinema</div>
          <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.8, maxWidth: 680 }}>
            A single-page projection room for a personal film archive: 26 tables from the supplied schema, plus two
            client-only archive tables for AI turns. Every AI feature calls the model provider directly from the
            browser, with streaming, live reasoning, resumable output, full sampling controls and exact request
            inspection.
          </p>
          <div className="filter-row" style={{ marginTop: 10 }}>
            <Chip mono sm>Vite · React 18 · TypeScript</Chip>
            <Chip mono sm>local-first</Chip>
            <Chip mono sm>no proxy</Chip>
            <Chip mono sm>no analytics</Chip>
          </div>
        </section>

        <section className="card card--pad">
          <div className="panel-title">Keyboard</div>
          <dl className="kv">
            <dt>⌘K</dt><dd>Command palette</dd>
            <dt>⌘⇧N</dt><dd>New title</dd>
            <dt>⌘⏎</dt><dd>Send in the booth</dd>
            <dt>⇧⏎</dt><dd>New line in the composer</dd>
            <dt>⌘⇧⌫</dt><dd>Delete the current thread (asks first)</dd>
          </dl>
        </section>

        <section className="card card--pad">
          <div className="panel-title">Where the data lives</div>
          <dl className="kv">
            <dt>Database</dt><dd>localStorage · fmc.v2.db</dd>
            <dt>Settings</dt><dd>localStorage · fmc.v2.settings</dd>
            <dt>Provider key</dt><dd>localStorage or sessionStorage · fmc.v2.key</dd>
            <dt>Requests</dt><dd>Archived per turn, Authorization redacted</dd>
          </dl>
          <Notice tone="warn" icon={<ShieldCheck size={13} />}>
            This build has no server and no sign-in. The archive is only as safe as this browser profile.
          </Notice>
        </section>
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">System · preferences</div>
          <h1 className="page-title">
            The room, <em>tuned.</em>
          </h1>
          <p className="page-sub">
            Appearance, provider and storage. The key is the only secret here, and it stays on this device.
          </p>
        </div>
        <div className="page-actions">
          <span className="mono" style={{ fontSize: 9, color: hasApiKey() ? 'var(--success)' : 'var(--text-4)' }}>
            {hasApiKey() ? '● provider key armed' : '○ no provider key'}
          </span>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'appearance', label: 'Appearance' },
          { id: 'booth', label: 'Projection booth' },
          { id: 'data', label: 'Data' },
          { id: 'about', label: 'About' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div style={{ marginTop: 'var(--sp-4)' }}>{tabContent()}</div>
    </>
  );
}
