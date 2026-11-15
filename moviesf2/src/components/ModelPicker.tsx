/** Model chooser with search, free/reasoning flags and context limits. */

import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Cpu, Loader2, RefreshCw, Search } from 'lucide-react';
import type { ModelInfo } from '../types';
import { useModelCatalogue, syncCatalogue, isSyncing } from '../ai/models';
import { contextWindow } from '../lib/format';
import { useOnClickOutside } from './ui';

export function ModelPicker({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const models = useModelCatalogue();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [syncing, setSyncing] = useState(false);
  useOnClickOutside(ref, () => setOpen(false), open);

  const current = models.find((model) => model.id === value);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return models
      .filter((model) => !needle || `${model.id} ${model.name} ${model.vendor}`.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [models, search]);

  return (
    <div className="model-pick" ref={ref}>
      <button type="button" className="model-pick__btn" onClick={() => setOpen((state) => !state)} aria-haspopup="listbox">
        <Cpu size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="model-pick__name" style={{ display: 'block' }}>
            {current?.name || value || 'Choose a model'}
          </span>
          {!compact && (
            <span className="model-pick__sub" style={{ display: 'block' }}>
              {current ? `${current.vendor} · ${contextWindow(current.contextLength)} ctx` : 'No model selected'}
            </span>
          )}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-4)' }} />
      </button>
      {open && (
        <div className="model-menu" role="listbox">
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <Search size={11} style={{ position: 'absolute', left: 7, top: 8, color: 'var(--text-4)' }} />
            <input
              className="param-number"
              style={{ paddingLeft: 22 }}
              placeholder="Search models…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
          </div>
          {filtered.map((model) => (
            <button
              key={model.id}
              type="button"
              className={`model-option ${model.id === value ? 'is-active' : ''}`}
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              role="option"
              aria-selected={model.id === value}
            >
              <span className={`model-option__dot ${model.isFree ? 'is-free' : ''} ${model.supportsReasoning ? 'is-reasoning' : ''}`} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {model.name}
              </span>
              {model.supportsReasoning && <span style={{ fontSize: 8, color: 'var(--accent)' }}>R</span>}
              {model.id === value && <Check size={11} />}
              <small>{contextWindow(model.contextLength)}</small>
            </button>
          ))}
          {!filtered.length && (
            <div style={{ padding: 10, fontSize: 10, color: 'var(--text-4)' }}>No model matches that search.</div>
          )}
          <button
            type="button"
            className="model-option"
            onClick={async () => {
              setSyncing(true);
              await syncCatalogue();
              setSyncing(false);
            }}
            disabled={syncing}
            style={{ borderTop: '1px solid var(--border-1)', marginTop: 4, paddingTop: 7 }}
          >
            {syncing || isSyncing() ? <Loader2 size={11} style={{ animation: 'fmc-spin 900ms linear infinite' }} /> : <RefreshCw size={11} />}
            Sync free catalogue
          </button>
        </div>
      )}
    </div>
  );
}

export function ModelBadge({ modelId }: { modelId: string }) {
  const models = useModelCatalogue();
  const model = models.find((item) => item.id === modelId) as ModelInfo | undefined;
  return (
    <span className="chip chip--mono" title={modelId}>
      {model?.name || modelId}
    </span>
  );
}
