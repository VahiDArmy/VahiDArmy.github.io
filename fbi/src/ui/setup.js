import { icon } from '../lib/icons.js';
import { escapeHtml, copyText } from '../lib/utils.js';
import { SUPABASE_URL, TABLE } from '../lib/config.js';
import { t } from '../lib/i18n.js';
import { toast } from './toast.js';
import schemaSql from '../../supabase/schema.sql?raw';

export function renderSetupScreen(reason = '') {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-shell" style="grid-template-columns:1fr">
      <div class="bg-layers" aria-hidden="true">
        <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
      </div>
      <section class="auth-panel">
        <div class="setup-box">
          <div class="brand" style="padding:0">
            <div class="logo">${icon('spark')}</div>
            <div class="brand-text"><span class="brand-name">Nebula</span><span class="brand-sub">AI Studio</span></div>
          </div>
          <h1>${t('One step left: create the tables')}</h1>
          <p>
            ${t('Nebula stores everything in your own Supabase project. The five tables it needs are prefixed')}
            <code>fbai_</code>. ${t('Paste the SQL below into the Supabase SQL editor once, then reload this page.')}
          </p>
          ${reason ? `<div class="auth-msg err">${escapeHtml(reason)}</div>` : ''}
          <ol>
            <li>${t('Open your project')} <a href="${SUPABASE_URL.replace('.supabase.co', '.supabase.co')}" target="_blank" rel="noopener">${escapeHtml(SUPABASE_URL)}</a></li>
            <li>${t('Go to SQL Editor → New query.')}</li>
            <li>${t('Paste the script below and press Run.')}</li>
            <li>${t('Reload this page. Your profile, chats, models and prompts will be created automatically.')}</li>
          </ol>
          <div class="row wrap">
            <button class="btn btn-primary" id="setup-copy">${icon('copy')} ${t('Copy SQL')}</button>
            <button class="btn" id="setup-reload">${icon('refresh')} ${t('Reload')}</button>
            <span class="muted tiny-text mono">${TABLE.profiles} · ${TABLE.conversations} · ${TABLE.messages} · ${TABLE.models} · ${TABLE.prompts}</span>
          </div>
          <pre class="setup-sql" id="setup-sql">${escapeHtml(schemaSql.trim())}</pre>
        </div>
      </section>
    </div>`;

  app.querySelector('#setup-copy').addEventListener('click', async () => {
    const ok = await copyText(schemaSql);
    toast(ok ? t('SQL copied — paste it in the Supabase SQL editor.') : t('Copy failed. Select the SQL manually.'), {
      type: ok ? 'ok' : 'err',
    });
  });
  app.querySelector('#setup-reload').addEventListener('click', () => location.reload());
}
