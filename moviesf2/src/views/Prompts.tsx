/** The prompt rack: reusable instructions, run directly. */

import { useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, updateRow, useDb } from '../data/store';
import { applyTemplate, templateVariables, STARTER_PROMPTS } from '../ai/prompts';
import { useSettings } from '../data/settings';
import type { AiAction, PromptTemplate } from '../types';
import { AiPanel } from '../components/AiPanel';
import { SEED_PROMPT_CATEGORIES } from '../components/constants';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  SearchField,
  Select,
  Tabs,
  Textarea,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

export function Prompts() {
  const db = useDb();
  const settings = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [tab, setTab] = useState<'rack' | 'starters'>('rack');
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [filling, setFilling] = useState<PromptTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [runAction, setRunAction] = useState<AiAction | null>(null);
  const [draft, setDraft] = useState({ name: '', body: '', category: 'review', variables: '' });

  const prompts = useMemo(
    () =>
      db.cinema_prompts
        .filter((prompt) => {
          if (category !== 'all' && prompt.category !== category) return false;
          if (!search.trim()) return true;
          return `${prompt.name} ${prompt.body} ${prompt.category}`.toLowerCase().includes(search.toLowerCase());
        })
        .sort((a, b) => b.use_count - a.use_count),
    [db.cinema_prompts, search, category],
  );

  const create = () => {
    if (!draft.name.trim() || !draft.body.trim()) return;
    insertRow('cinema_prompts', {
      name: draft.name.trim(),
      body: draft.body,
      category: draft.category,
      variables: draft.variables || templateVariables(draft.body).join(', '),
      use_count: 0,
    } as never);
    setCreating(false);
    setDraft({ name: '', body: '', category: 'review', variables: '' });
    toast.push({ tone: 'success', title: 'Prompt saved' });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateRow('cinema_prompts', editing.id, {
      name: editing.name,
      body: editing.body,
      category: editing.category,
      variables: editing.variables,
    });
    setEditing(null);
    toast.push({ tone: 'success', title: 'Prompt updated' });
  };

  const startFill = (prompt: PromptTemplate) => {
    const vars = templateVariables(prompt.body);
    if (!vars.length) {
      launch(prompt, prompt.body);
      return;
    }
    setFilling(prompt);
    setValues(Object.fromEntries(vars.map((variable) => [variable, ''])));
  };

  const launch = (prompt: PromptTemplate, body: string) => {
    const action: AiAction = {
      id: `prompt-${prompt.id}`,
      label: prompt.name,
      hint: prompt.category,
      group: 'writing',
      icon: 'scroll-text',
      expectsJson: /return json|strict json|json object/i.test(body),
      system: settings.systemPrompt,
      user: () => body,
    };
    updateRow('cinema_prompts', prompt.id, { use_count: prompt.use_count + 1 });
    setFilling(null);
    setRunAction(action);
  };

  const useStarter = (body: string) => {
    const action: AiAction = {
      id: 'starter',
      label: 'Shelf prompt',
      hint: 'starter',
      group: 'analysis',
      icon: 'sparkles',
      expectsJson: false,
      system: settings.systemPrompt,
      user: () => body,
    };
    setRunAction(action);
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Intelligence · {db.cinema_prompts.length} saved prompts</div>
          <h1 className="page-title">
            Instructions worth <em>repeating.</em>
          </h1>
          <p className="page-sub">
            A prompt is a contract with the model. Keep the ones that consistently produce something you would not
            delete.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            New prompt
          </Button>
        </div>
      </div>

      <div className="library-bar" style={{ position: 'static' }}>
        <div style={{ flex: 1, maxWidth: 300 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search prompts…" />
        </div>
        <Select className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          {SEED_PROMPT_CATEGORIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </Select>
        <span className="count-label" style={{ marginLeft: 'auto' }}><b>{prompts.length}</b> prompts</span>
      </div>

      <Tabs
        tabs={[
          { id: 'rack', label: 'Prompt rack', count: prompts.length },
          { id: 'starters', label: 'Starters', count: STARTER_PROMPTS.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div style={{ marginTop: 'var(--sp-4)' }}>
        {tab === 'rack' ? (
          prompts.length ? (
            <div className="prompt-grid stagger">
              {prompts.map((prompt) => (
                <article className="prompt-card" key={prompt.id}>
                  <div className="prompt-card__head">
                    <div className="prompt-card__name">{prompt.name}</div>
                    <Chip sm mono>{prompt.category}</Chip>
                  </div>
                  <div className="prompt-card__body">{prompt.body}</div>
                  <div className="prompt-card__vars">
                    {templateVariables(prompt.body).map((variable) => (
                      <span className="tag" key={variable}>{"{{"}{variable}{"}}"}</span>
                    ))}
                    {!templateVariables(prompt.body).length && <span className="faint" style={{ fontSize: 9 }}>no variables</span>}
                  </div>
                  <div className="prompt-card__foot">
                    <span>{prompt.use_count} runs</span>
                    <span style={{ marginLeft: 'auto' }} className="row">
                      <button className="icon-btn icon-btn--sm" title="Run prompt" onClick={() => startFill(prompt)}>
                        <Sparkles size={12} />
                      </button>
                      <button className="icon-btn icon-btn--sm" title="Edit" onClick={() => setEditing(prompt)}>
                        <Pencil size={11} />
                      </button>
                      <button
                        className="icon-btn icon-btn--sm"
                        title="Duplicate"
                        onClick={() => {
                          insertRow('cinema_prompts', {
                            name: `${prompt.name} (copy)`,
                            body: prompt.body,
                            category: prompt.category,
                            variables: prompt.variables,
                            use_count: 0,
                          } as never);
                          toast.push({ tone: 'success', title: 'Prompt duplicated' });
                        }}
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        className="icon-btn icon-btn--sm"
                        title="Delete"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Delete “${prompt.name}”?`,
                            body: 'The prompt is removed from the rack. Existing conversations are untouched.',
                            confirmLabel: 'Delete',
                            danger: true,
                          });
                          if (ok) removeRow('cinema_prompts', prompt.id);
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Sparkles size={22} />} title="No prompts match" text="Clear the filters, or write a new instruction." />
          )
        ) : (
          <div className="prompt-grid stagger">
            {STARTER_PROMPTS.map((starter) => (
              <article className="prompt-card" key={starter.label}>
                <div className="prompt-card__head">
                  <div className="prompt-card__name">{starter.label}</div>
                  <Chip sm mono>{starter.group}</Chip>
                </div>
                <div className="prompt-card__body" style={{ WebkitLineClamp: 7 }}>{starter.body}</div>
                <div className="prompt-card__foot">
                  <Chip sm mono>no variables</Chip>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Sparkles size={11} />}
                    style={{ marginLeft: 'auto' }}
                    onClick={() => useStarter(starter.body)}
                  >
                    Run
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <Modal
          title={editing ? 'Edit prompt' : 'New prompt'}
          subtitle="The body is sent verbatim, with variables substituted."
          icon={<Sparkles size={16} />}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          size="lg"
          actions={
            <>
              <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
              <Button variant="primary" onClick={editing ? saveEdit : create}>{editing ? 'Save' : 'Add prompt'}</Button>
            </>
          }
        >
          <div className="stack">
            <div className="cols-2">
              <Field label="Name">
                <Input
                  value={editing ? editing.name : draft.name}
                  onChange={(event) =>
                    editing ? setEditing({ ...editing, name: event.target.value }) : setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  autoFocus
                />
              </Field>
              <Field label="Category">
                <Select
                  value={editing ? editing.category : draft.category}
                  onChange={(event) =>
                    editing ? setEditing({ ...editing, category: event.target.value }) : setDraft((current) => ({ ...current, category: event.target.value }))
                  }
                >
                  {SEED_PROMPT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Body" hint="Use {{variable}} for values filled at run time.">
              <Textarea
                className="textarea--tall textarea--mono"
                value={editing ? editing.body : draft.body}
                onChange={(event) =>
                  editing ? setEditing({ ...editing, body: event.target.value }) : setDraft((current) => ({ ...current, body: event.target.value }))
                }
              />
            </Field>
            <div className="filter-row">
              {templateVariables(editing ? editing.body : draft.body).map((variable) => (
                <span className="tag" key={variable}>{"{{"}{variable}{"}}"}</span>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {filling && (
        <Modal
          title={filling.name}
          subtitle="Fill the variables, then run it in the booth."
          onClose={() => setFilling(null)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setFilling(null)}>Cancel</Button>
              <Button variant="primary" icon={<Sparkles size={13} />} onClick={() => launch(filling, applyTemplate(filling.body, values))}>
                Run in booth
              </Button>
            </>
          }
        >
          <div className="stack">
            {Object.keys(values).map((variable) => (
              <Field key={variable} label={variable}>
                <Input value={values[variable]} onChange={(event) => setValues((current) => ({ ...current, [variable]: event.target.value }))} />
              </Field>
            ))}
            <div className="panel panel--flat">
              <div className="panel-title">Preview</div>
              <pre className="codeblock codeblock--wrap" style={{ maxHeight: 220 }}>{applyTemplate(filling.body, values)}</pre>
            </div>
          </div>
        </Modal>
      )}

      {runAction && (
        <AiPanel
          action={runAction}
          onClose={() => setRunAction(null)}
          onSendToStudio={(threadId) => {
            setRunAction(null);
            navigate('studio', threadId);
          }}
        />
      )}
    </>
  );
}
