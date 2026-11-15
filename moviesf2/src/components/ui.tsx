/**
 * The component shelf. Everything here is local: no UI kit, no icon font,
 * no chart library. Lucide supplies the glyphs; the rest is CSS.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { HTMLAttributes } from 'react';
import type { Category, ToastMessage, ToastTone } from '../types';
import { categoryGlyph, compact, n, pct, score } from '../lib/format';
import { copyText, hashHue } from '../lib/utils';

/* ── class helpers ─────────────────────────────────────────────────────── */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: () => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [ref, handler, active]);
}

export function useLocalState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* preferences are best-effort */
      }
    },
    [key],
  );
  return [value, set];
}

/* ── toasts ────────────────────────────────────────────────────────────── */

interface ToastContextValue {
  push: (toast: Omit<ToastMessage, 'id'> | string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined, dismiss: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: Omit<ToastMessage, 'id'> | string) => {
      const toast: ToastMessage =
        typeof input === 'string'
          ? { id: `t-${Date.now()}-${Math.random()}`, tone: 'info', title: input, duration: 3600 }
          : { id: `t-${Date.now()}-${Math.random()}`, duration: 4200, ...input };
      setToasts((current) => [...current.slice(-3), toast]);
      if (toast.duration !== 0) {
        window.setTimeout(() => dismiss(toast.id), toast.duration || 4200);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="toasts" role="status" aria-live="polite">
            {toasts.map((toast) => (
              <div className={`toast toast--${toast.tone}`} key={toast.id}>
                <span className="toast__icon">
                  {toast.tone === 'success' ? (
                    <Check size={15} />
                  ) : toast.tone === 'error' ? (
                    <AlertTriangle size={15} />
                  ) : toast.tone === 'warn' ? (
                    <AlertTriangle size={15} />
                  ) : (
                    <Info size={15} />
                  )}
                </span>
                <div className="toast__body">
                  <div className="toast__title">{toast.title}</div>
                  {toast.body && <div className="toast__text">{toast.body}</div>}
                  {toast.action && (
                    <button
                      className="toast__action"
                      onClick={() => {
                        toast.action?.run();
                        dismiss(toast.id);
                      }}
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/* ── confirm ───────────────────────────────────────────────────────────── */

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ options, resolve }));
  }, []);

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          title={state.options.title}
          subtitle={state.options.body}
          size="sm"
          onClose={() => close(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                {state.options.cancelLabel || 'Cancel'}
              </Button>
              <Button variant={state.options.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {state.options.confirmLabel || 'Confirm'}
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.7 }}>
            {state.options.body ? 'This action is written to the local database immediately.' : ''}
          </p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

/* ── buttons ───────────────────────────────────────────────────────────── */

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'outline' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  pill?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  block,
  pill,
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        block && 'btn--block',
        pill && 'btn--pill',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export function IconButton({ label, active, size = 'md', className, children, ...rest }: IconButtonProps) {
  return (
    <button
      className={cx('icon-btn', active && 'is-active', size === 'sm' && 'icon-btn--sm', className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Tooltip({
  children,
  tip,
  className,
  'data-tip': dataTip,
  ...rest
}: {
  children: ReactNode;
  tip?: string;
  className?: string;
  'data-tip'?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'title'>) {
  return (
    <span className={cx('tooltip', className)} title={tip || dataTip} {...rest}>
      {children}
    </span>
  );
}

export function CopyButton({
  text,
  label = 'Copy',
  onCopied,
}: {
  text: string;
  label?: string;
  onCopied?: () => void;
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={done ? <Check size={12} /> : <Copy size={12} />}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setDone(true);
          onCopied?.();
          window.setTimeout(() => setDone(false), 1600);
        }
      }}
    >
      {done ? 'Copied' : label}
    </Button>
  );
}

/* ── small atoms ───────────────────────────────────────────────────────── */

export function Chip({
  children,
  tone,
  active,
  sm,
  mono,
  onClick,
  title,
}: {
  children: ReactNode;
  tone?: 'love' | 'good' | 'hate' | 'accent';
  active?: boolean;
  sm?: boolean;
  mono?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const className = cx(
    'chip',
    tone && `chip--${tone}`,
    active && 'is-active',
    sm && 'chip--sm',
    mono && 'chip--mono',
  );
  if (onClick) {
    return (
      <button className={className} onClick={onClick} title={title} type="button">
        {children}
      </button>
    );
  }
  return (
    <span className={className} title={title}>
      {children}
    </span>
  );
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'live' | 'danger' | 'success';
}) {
  return <span className={cx('badge', tone && `badge--${tone}`)}>{children}</span>;
}

export function CategoryChip({ category }: { category: Category | string }) {
  const tone = category === 'love' ? 'love' : category === 'hate' ? 'hate' : 'good';
  return (
    <Chip tone={tone} sm mono>
      <span aria-hidden>{categoryGlyph(category)}</span>
      {category}
    </Chip>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Tag({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button type="button" className={cx('tag', active && 'is-active')} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <span className="tag">{children}</span>;
}

export function Dot({ live }: { live?: boolean }) {
  return <span className={cx('dot', live && 'dot--live')} />;
}

export function Avatar({
  name,
  size,
  accent,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  accent?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cx(
        'avatar',
        size === 'lg' && 'avatar--lg',
        size === 'sm' && 'avatar--sm',
        accent && 'avatar--accent',
      )}
      title={name}
    >
      {initials || '?'}
    </span>
  );
}

/* ── form fields ───────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  meta,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  meta?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('field', className)}>
      {(label || meta) && (
        <span className="field__label">
          {label}
          {meta && <em>{meta}</em>}
        </span>
      )}
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('input', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('textarea', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx('select', props.className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="toggle" style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="toggle__track" />
      <span>{label}</span>
    </label>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-row__copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} label="" />
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  display,
  hint,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  label?: string;
  display?: string;
  hint?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="param-row">
      {label && (
        <div className="param-row__head">
          <span>{label}</span>
          <b>{display ?? value}</b>
        </div>
      )}
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        aria-label={label}
      />
      {hint && <div className="param-row__hint">{hint}</div>}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  autoFocus,
  onClear,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onClear?: () => void;
}) {
  return (
    <div className="search-field">
      <Search size={14} />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
      {value && (
        <button
          className="search-field__clear"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          aria-label="Clear search"
          type="button"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function TagInput({
  tags,
  onChange,
  placeholder = 'Add tag…',
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    if (!tags.includes(value)) onChange([...tags, value]);
    setDraft('');
  };
  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <span className="tag-pill" key={tag}>
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((item) => item !== tag))} aria-label={`Remove ${tag}`}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

/* ── overlays ──────────────────────────────────────────────────────────── */

export function Modal({
  title,
  subtitle,
  children,
  actions,
  onClose,
  size = 'md',
  flush,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  flush?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={cx('modal', `modal--${size}`, className)} role="dialog" aria-modal="true">
        <div className="modal__head">
          {icon && <span style={{ color: 'var(--accent)', marginTop: 2 }}>{icon}</span>}
          <div className="modal__heading">
            <div className="modal__title">{title}</div>
            {subtitle && <div className="modal__sub">{subtitle}</div>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className={cx('modal__body', flush && 'modal__body--flush')}>{children}</div>
        {actions && <div className="modal__foot">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  title,
  subtitle,
  children,
  onClose,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className="scrim" style={{ padding: 0, placeItems: 'stretch' }} onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal__title">{title}</div>
            {subtitle && <div className="modal__sub">{subtitle}</div>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="drawer__body">{children}</div>
        {actions && <div className="modal__foot">{actions}</div>}
      </aside>
    </>,
    document.body,
  );
}

export function Menu({
  trigger,
  children,
  align = 'right',
}: {
  trigger: (props: { onClick: () => void; open: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="model-pick" ref={ref} style={{ width: 'auto' }}>
      {trigger({ onClick: () => setOpen((value) => !value), open })}
      {open && (
        <div
          className="menu"
          style={align === 'right' ? { right: 0, left: 'auto', position: 'absolute', top: 'calc(100% + 4px)' } : { left: 0, top: 'calc(100% + 4px)' }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/* ── tabs ──────────────────────────────────────────────────────────────── */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; count?: number; icon?: ReactNode }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          className={cx('tab', value === tab.id && 'is-active')}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && <span className="tab__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.id}
          className={cx(value === option.id && 'is-active')}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ── data display ──────────────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  suffix,
  foot,
  icon,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  foot?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat__label">
        {icon}
        {label}
      </div>
      <div className="stat__value">
        {value}
        {suffix && <small>{suffix}</small>}
      </div>
      {foot && <div className="stat__foot">{foot}</div>}
    </div>
  );
}

export function Meter({
  value,
  tone,
  thin,
  thick,
  label,
}: {
  value: number;
  tone?: 'love' | 'good' | 'danger';
  thin?: boolean;
  thick?: boolean;
  label?: ReactNode;
}) {
  return (
    <div style={{ width: '100%' }}>
      {label && <div className="meter-label">{label}</div>}
      <div className={cx('meter', thin && 'meter--thin', thick && 'meter--thick', tone && `meter--${tone}`)}>
        <div className="meter__fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 74,
  stroke = 6,
  label,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-4)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color || 'var(--accent)'}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 700ms var(--ease-out)' }}
        />
      </svg>
      <span className="progress-ring__label">{label ?? `${Math.round(value)}%`}</span>
    </div>
  );
}

export function Sparkline({
  values,
  height = 44,
  area = true,
}: {
  values: number[];
  height?: number;
  area?: boolean;
}) {
  const width = 240;
  if (!values.length) return <div className="spark" />;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(' L')}`;
  const areaPath = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }}>
      {area && <path className="area" d={areaPath} />}
      <path className="line" d={line} />
    </svg>
  );
}

export function Bars({
  data,
  height = 90,
  format,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  format?: (value: number) => string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="bars" style={{ height }}>
      {data.map((item) => (
        <div className="bars__item" key={item.label} title={`${item.label}: ${format ? format(item.value) : item.value}`}>
          <div className="bars__fill" style={{ height: `${(item.value / max) * 100}%` }} />
          <span className="bars__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  data,
  size = 116,
  centerLabel,
  centerValue,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: ReactNode;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = size / 2 - 9;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} className="donut">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-4)" strokeWidth={10} />
            {data.map((item) => {
              const length = (item.value / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const element = (
                <circle
                  key={item.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={10}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += length;
              return element;
            })}
          </g>
          <text
            x="50%"
            y="46%"
            textAnchor="middle"
            className="donut__center"
            style={{ fontSize: 24 }}
            fill="var(--text-1)"
          >
            {centerValue ?? total}
          </text>
          <text x="50%" y="62%" textAnchor="middle" fill="var(--text-4)" style={{ fontSize: 8, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
            {(centerLabel || 'TOTAL').toUpperCase()}
          </text>
        </svg>
      </div>
      <div className="donut-legend">
        {data.map((item) => (
          <div className="donut-legend__row" key={item.label}>
            <i style={{ background: item.color }} />
            <span>{item.label}</span>
            <b>{n(item.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Heatmap({ cells }: { cells: Array<{ key: string; minutes: number; level: number; date: Date }> }) {
  const weeks: typeof cells[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return (
    <div>
      <div className="heatmap">
        {weeks.map((week, weekIndex) => (
          <div className="heatmap__col" key={weekIndex}>
            {week.map((cell) => (
              <div
                className="heatmap__cell"
                key={cell.key}
                data-level={cell.level}
                title={`${cell.key} · ${cell.minutes} minutes`}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-4)' }}>
          {cells[0]?.key} → {cells[cells.length - 1]?.key}
        </span>
        <div className="legend">
          less
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} data-level={level} />
          ))}
          more
        </div>
      </div>
    </div>
  );
}

export function Stars({ value, max = 10 }: { value: number; max?: number }) {
  const filled = Math.round((value / max) * 5);
  return (
    <span className="stars" title={`${value}/${max}`} aria-label={`${value} out of ${max}`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <svg
          key={index}
          className={cx('star', index <= filled && 'is-on')}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
        </svg>
      ))}
    </span>
  );
}

export function EmptyState({
  title,
  text,
  icon,
  action,
}: {
  title: string;
  text?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon || <Sparkles size={22} />}
      <div className="empty__title">{title}</div>
      {text && <p className="empty__text">{text}</p>}
      {action}
    </div>
  );
}

export function Notice({
  tone = 'default',
  children,
  icon,
}: {
  tone?: 'default' | 'accent' | 'warn' | 'danger' | 'success';
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={cx('notice', tone !== 'default' && `notice--${tone}`)}>
      {icon || <Info size={14} />}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 size={size} className="spin" style={{ animation: 'fmc-spin 900ms linear infinite' }} />;
}

export function CodeBlock({ text, wrap, maxHeight }: { text: string; wrap?: boolean; maxHeight?: number }) {
  return (
    <pre className={cx('codeblock', wrap && 'codeblock--wrap')} style={maxHeight ? { maxHeight } : undefined}>
      {text}
    </pre>
  );
}

/* ── procedural poster ─────────────────────────────────────────────────── */

const POSTER_GLYPHS = ['◆', '◇', '●', '○', '◐', '◑', '✕', '✶', '⌗', '∿', '▣', '◈'];

export function posterStyle(seed: string, category: Category | string): CSSProperties {
  const hue = hashHue(seed);
  const second = (hue + 42) % 360;
  const catHue = category === 'love' ? 330 : category === 'hate' ? 354 : 214;
  return {
    background: [
      `radial-gradient(120% 86% at 22% 8%, hsl(${hue} 34% 26% / 0.95), transparent 62%)`,
      `radial-gradient(100% 70% at 88% 100%, hsl(${second} 40% 22% / 0.8), transparent 66%)`,
      `linear-gradient(155deg, hsl(${catHue} 22% 13%), #08080a 72%)`,
    ].join(', '),
  };
}

export function Poster({
  title,
  year,
  category,
  score: rating,
  favorite,
  size,
  wide,
  onClick,
  flat,
}: {
  title: string;
  year?: number | null;
  category: Category | string;
  score?: number;
  favorite?: boolean;
  size?: 'sm';
  wide?: boolean;
  onClick?: () => void;
  flat?: boolean;
}) {
  const glyph = POSTER_GLYPHS[hashHue(title) % POSTER_GLYPHS.length];
  const style = posterStyle(`${title}${year || ''}`, category);
  const body = (
    <>
      <div className="poster__art" style={style}>
        <span className="poster__glyph" aria-hidden>
          {glyph}
        </span>
        <div className="poster__top">
          <span className="poster__year" style={{ letterSpacing: '0.12em' }}>
            {categoryGlyph(category)} {category.toUpperCase()}
          </span>
          {favorite && (
            <span className="poster__fav" aria-label="Favourite">
              ★
            </span>
          )}
        </div>
        <div>
          <div className="poster__title">{title}</div>
          <div className="poster__foot">
            <span className="poster__year">{year || '—'}</span>
            {rating ? <span className="poster__score">{score(rating)}</span> : <span className="poster__year">—</span>}
          </div>
        </div>
      </div>
      <span className="poster__cat" data-cat={category === 'love' ? 'love' : category === 'hate' ? 'hate' : 'good'} />
    </>
  );
  const className = cx('poster', size === 'sm' && 'poster--sm', wide && 'poster--wide', flat && 'poster--flat');
  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`${title}${year ? `, ${year}` : ''}`}
        style={{ width: '100%', textAlign: 'left', padding: 0 }}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={className} role="img" aria-label={`${title}${year ? `, ${year}` : ''}`}>
      {body}
    </div>
  );
}

export function MiniPoster({ title, category }: { title: string; category: Category | string }) {
  return (
    <div className="mini-poster" style={posterStyle(title, category)} aria-hidden>
      <span>{title.slice(0, 1)}</span>
    </div>
  );
}

/* ── misc ──────────────────────────────────────────────────────────────── */

export function SectionHead({
  title,
  count,
  action,
}: {
  title: ReactNode;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <h2 className="section-title">
        {title}
        {count !== undefined && <span className="count">{n(count)}</span>}
      </h2>
      {action}
    </div>
  );
}

export function DataRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

export function Collapse({
  title,
  children,
  open: initial = false,
  icon,
  meta,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
  icon?: ReactNode;
  meta?: ReactNode;
}) {
  const [open, setOpen] = useState(initial);
  const id = useId();
  return (
    <div className={cx('accordion', open && 'is-open')}>
      <button className="accordion__head" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={id}>
        {icon}
        {title}
        {meta && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-4)' }}>{meta}</span>}
        <ChevronRight size={13} className="accordion__chev" style={meta ? { marginLeft: 6 } : undefined} />
      </button>
      {open && (
        <div className="accordion__body" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}

export function Pct({ value }: { value: number }) {
  return <span className="mono">{pct(value, 0)}</span>;
}

export function Kpi({ value }: { value: number }) {
  return <span className="mono">{compact(value)}</span>;
}

export function useScrollToBottom(dependency: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onScroll = () => {
      pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [dependency]);
  return ref;
}

export function useHotkey(combo: string, handler: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const parts = combo.toLowerCase().split('+');
      const needsMeta = parts.includes('mod') || parts.includes('cmd');
      const needsShift = parts.includes('shift');
      const key = parts[parts.length - 1];
      const metaOk = needsMeta ? event.metaKey || event.ctrlKey : true;
      const shiftOk = needsShift ? event.shiftKey : true;
      if (metaOk && shiftOk && event.key.toLowerCase() === key) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, handler]);
}

export function IconGlyph({ name, size = 14 }: { name: string; size?: number }) {
  return <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>{name}</span>;
}

export { ChevronDown };
