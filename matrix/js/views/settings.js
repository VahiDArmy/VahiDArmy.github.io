/* views/settings.js — preferences, sound, account, data */
import { sb, state, esc, icon, fa, faNum, toast, openModal, confirmDialog, play, haptic, getPrefs, savePrefs, errMsg, isAdmin, timeAgo } from '../core.js';
import { loadAll } from '../data.js';
import { getKey, setKey } from '../ai.js';

const ACCENTS = [['aqua', '#35e0d0'], ['violet', '#8b7cff'], ['magenta', '#ff5fa2'], ['amber', '#ffb454'], ['lime', '#a6f36b']];

export async function render(host) {
  const p = getPrefs();
  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('settings')} تنظیمات</h2>
      <div class="pagehead__sub">ظاهر، صدا، داده و حساب</div>
      <div class="spacer"></div>
      <button class="btn btn--sm" id="st-refresh">${icon('refresh')} بارگذاری داده</button>
    </div>
    <div class="grid grid--2" style="align-items:start">
      <section class="panel">
        <div class="panel__head">${icon('spark')}<h3>ظاهر</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:11px">
          <div class="field"><span>رنگ لهجه</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${ACCENTS.map(([k, c]) => `<button data-acc="${k}" title="${k}" style="width:30px;height:30px;border-radius:9px;background:${c};border:2px solid ${p.accent === k ? '#fff' : 'transparent'}"></button>`).join('')}
            </div></div>
          <div class="field"><span>چیدمان میزها</span><select id="st-density">
            ${[['comfortable', 'راحت'], ['compact', 'فشرده'], ['dense', 'خیلی فشرده']].map(([v, l]) => `<option value="${v}" ${p.density === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
          <div class="field"><span>طیف حرارتی</span><select id="st-heat">
            ${[['spectrum', 'طیف'], ['warm', 'گرم'], ['mono', 'تک‌رنگ']].map(([v, l]) => `<option value="${v}" ${p.heat === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
          <div class="field"><span>گام امتیاز</span><select id="st-step">
            ${[0.25, 0.5, 1].map((v) => `<option value="${v}" ${Number(p.scoreStep) === v ? 'selected' : ''}>${faNum(v, 2)}</option>`).join('')}
          </select></div>
          <div class="field"><span>نمای پیش‌فرض</span><select id="st-mode">
            ${[['trait', 'پایه ویژگی'], ['ranker', 'پایه امتیازدهنده'], ['target', 'پایه امتیازگیرنده']].map(([v, l]) => `<option value="${v}" ${p.defaultMode === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
          <label class="kv"><span class="kv__k">برچسب نام افراد در ستون‌ها</span><button class="switch ${p.showLabels ? 'is-on' : ''}" data-tgl="showLabels"></button></label>
          <label class="kv"><span class="kv__k">پنهان‌سازی مقادیر به‌صورت پیش‌فرض</span><button class="switch ${p.privacy ? 'is-on' : ''}" data-tgl="privacy"></button></label>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">${icon('wave')}<h3>صدا و لمس</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:11px">
          <label class="kv"><span class="kv__k">صدا</span><button class="switch ${p.sound ? 'is-on' : ''}" data-tgl="sound"></button></label>
          <label class="kv"><span class="kv__k">لرزش (هپتیک)</span><button class="switch ${p.haptics ? 'is-on' : ''}" data-tgl="haptics"></button></label>
          <label class="kv"><span class="kv__k">تأیید قبل از حذف</span><button class="switch ${p.confirmDelete ? 'is-on' : ''}" data-tgl="confirmDelete"></button></label>
          <label class="kv"><span class="kv__k">ذخیره خودکار سلول</span><button class="switch ${p.autoSave ? 'is-on' : ''}" data-tgl="autoSave"></button></label>
          <div class="field"><span>بلندی صدا <b id="st-volv">${fa(Math.round((p.volume ?? 0.5) * 100))}٪</b></span>
            <input type="range" id="st-vol" min="0" max="1" step="0.05" value="${p.volume ?? 0.5}"></div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="btn btn--sm" data-snd="clink">${icon('wave')} به‌هم خوردن لیوان</button>
            <button class="btn btn--sm" data-snd="clink2">دوتایی</button>
            <button class="btn btn--sm" data-snd="drop">افتادن</button>
            <button class="btn btn--sm" data-snd="err">خطا</button>
            <button class="btn btn--sm" data-snd="save">ثبت</button>
          </div>
          <span class="muted" style="font-size:10.5px">صداها با Web Audio ساخته می‌شوند؛ فایل صوتی ندارد.</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">${icon('brain')}<h3>هوش مصنوعی</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:9px">
          <div class="kv"><span class="kv__k">کلید OpenRouter</span><span class="chip ${getKey() ? 'chip--ok' : 'chip--warn'}">${getKey() ? 'ذخیره‌شده' : 'خالی'}</span></div>
          <div style="display:flex;gap:5px"><input id="st-key" type="password" dir="ltr" placeholder="sk-or-v1-…" value="${esc(getKey())}"><button class="btn btn--sm" id="st-keysave">${icon('check')}</button></div>
          <div class="field"><span>مدل پیش‌فرض</span><input id="st-model" dir="ltr" value="${esc(getPrefs().aiModel || '')}" placeholder="deepseek/deepseek-r1:free"></div>
          <div class="field"><span>استدلال</span><select id="st-eff">
            ${['off', 'low', 'medium', 'high'].map((x) => `<option value="${x}" ${(p.aiReasoning || 'medium') === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
          <button class="btn btn--sm" id="st-ai">${icon('brain')} بازکردن دستیار</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">${icon('user')}<h3>حساب</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:9px">
          <div class="kv"><span class="kv__k">ایمیل</span><span class="mono">${esc(state.user?.email || '—')}</span></div>
          <div class="kv"><span class="kv__k">نقش</span><span class="chip">${esc(state.profile?.role || (state.user ? 'member' : 'مهمان'))}</span></div>
          <div class="kv"><span class="kv__k">شناسه</span><span class="mono">${esc(state.user?.id?.slice(0, 12) || '—')}</span></div>
          <div class="kv"><span class="kv__k">آخرین ورود</span><span class="muted">${timeAgo(state.user?.last_sign_in_at)}</span></div>
          <div class="field"><span>نام نمایشی</span><input id="st-name" value="${esc(state.profile?.display_name || '')}"></div>
          <div class="field"><span>تصویر</span><input id="st-avatar" dir="ltr" value="${esc(state.profile?.avatar_url || '')}" placeholder="https://…"></div>
          <button class="btn btn--sm btn--primary" id="st-saveprofile">${icon('check')} ذخیره پروفایل</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">${icon('db')}<h3>داده</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:7px">
          <div class="kv"><span class="kv__k">افراد / ویژگی‌ها</span><b>${fa(state.people.length)} / ${fa(state.traits.length)}</b></div>
          <div class="kv"><span class="kv__k">امتیاز / گفتگو</span><b>${fa(state.scores.length)} / ${fa(state.comments.length)}</b></div>
          <div class="kv"><span class="kv__k">آخرین همگام</span><span class="muted">${timeAgo(state.lastSync)}</span></div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="btn btn--sm" id="st-reload">${icon('refresh')} همگام</button>
            <button class="btn btn--sm" id="st-export">${icon('download')} JSON</button>
            <button class="btn btn--sm btn--danger" id="st-clear">${icon('trash')} پاک‌سازی محلی</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">${icon('layers')}<h3>درباره</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:var(--ink-3)">
          <div class="kv"><span class="kv__k">نسخه</span><span>۱.۰ · SPA</span></div>
          <div class="kv"><span class="kv__k">پایگاه</span><span class="mono">${esc('nvmevkaovazhmoznusf.supabase.co')}</span></div>
          <div class="kv"><span class="kv__k">جدول‌ها</span><span class="mono" style="font-size:10px">people · mtx_*</span></div>
          <div class="kv"><span class="kv__k">وضعیت</span><span class="chip chip--ok">${isAdmin() ? 'مدیر' : 'عضو'}</span></div>
        </div>
      </section>
    </div>`;

  host.querySelectorAll('[data-acc]').forEach((b) => b.onclick = () => { savePrefs({ accent: b.dataset.acc }); play('clink'); render(host); });
  host.querySelectorAll('[data-tgl]').forEach((b) => b.onclick = () => {
    const k = b.dataset.tgl; const next = !getPrefs()[k];
    savePrefs({ [k]: next }); b.classList.toggle('is-on', next);
    if (k === 'sound' || k === 'haptics') play(next ? 'clink' : 'tap');
  });
  host.querySelectorAll('[data-snd]').forEach((b) => b.onclick = () => play(b.dataset.snd));
  host.querySelector('#st-density').onchange = (e) => savePrefs({ density: e.target.value });
  host.querySelector('#st-heat').onchange = (e) => savePrefs({ heat: e.target.value });
  host.querySelector('#st-step').onchange = (e) => savePrefs({ scoreStep: Number(e.target.value) });
  host.querySelector('#st-mode').onchange = (e) => savePrefs({ defaultMode: e.target.value });
  host.querySelector('#st-vol').oninput = (e) => {
    host.querySelector('#st-volv').textContent = `${fa(Math.round(e.target.value * 100))}٪`;
    savePrefs({ volume: Number(e.target.value) });
  };
  host.querySelector('#st-keysave').onclick = () => {
    const v = host.querySelector('#st-key').value.trim();
    if (v && !v.startsWith('sk-')) return toast('کلید باید با sk- شروع شود', 'warn');
    setKey(v); play('clink'); toast('کلید ذخیره شد', 'ok'); render(host);
  };
  host.querySelector('#st-model').onchange = (e) => savePrefs({ aiModel: e.target.value.trim() });
  host.querySelector('#st-eff').onchange = (e) => savePrefs({ aiReasoning: e.target.value });
  host.querySelector('#st-ai').onclick = () => import('../ai.js').then((m) => m.toggleDock(true));
  host.querySelector('#st-saveprofile').onclick = async () => {
    if (!state.user) return toast('وارد شوید', 'warn');
    const display_name = host.querySelector('#st-name').value.trim();
    const avatar_url = host.querySelector('#st-avatar').value.trim() || null;
    try {
      const { data, error } = await sb.from('profiles').upsert({ id: state.user.id, display_name, avatar_url }).select('*').single();
      if (error) throw error;
      state.profile = data; play('clink'); toast('پروفایل ذخیره شد', 'ok'); window.mx.paintStats();
    } catch (e) { toast(errMsg(e), 'err', 4000); }
  };
  host.querySelector('#st-refresh').onclick = host.querySelector('#st-reload').onclick = async () => {
    play('tap'); await loadAll(); toast('همگام شد', 'ok'); window.mx.rerender(true);
  };
  host.querySelector('#st-export').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ people: state.people, traits: state.traits, scores: state.scores }, null, 2)], { type: 'application/json' }));
    a.download = 'matrix3d-data.json'; a.click(); play('save');
  };
  host.querySelector('#st-clear').onclick = async () => {
    if (!await confirmDialog({ title: 'پاک‌سازی محلی', text: 'تنظیمات و فهرست مدل‌های ذخیره‌شده محلی پاک شوند (کلید API هم حذف می‌شود).', danger: true, okText: 'پاک کن' })) return;
    ['mx3.prefs', 'mx3.models', 'mx3.orKey'].forEach((k) => localStorage.removeItem(k));
    toast('پاک شد', 'ok'); setTimeout(() => location.reload(), 700);
  };
  void openModal;
}
