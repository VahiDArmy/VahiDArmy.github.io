// ============================================================================
// supabase.js — minimalist Supabase REST client (PostgREST over fetch)
// No SDK dependency, works with the publishable/anon key.
// ============================================================================

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const BASE = `${SUPABASE_URL}/rest/v1`;

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
  };
}

async function request(path, { method = "GET", body, query, prefer, extraHeaders } = {}) {
  let url = `${BASE}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const res = await fetch(url, {
    method,
    headers: headers({ ...(prefer ? { Prefer: prefer } : {}), ...(extraHeaders || {}) }),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = null;
    try {
      detail = await res.json();
    } catch {
      try {
        detail = await res.text();
      } catch {
        detail = null;
      }
    }
    const err = new Error(
      `Supabase ${method} ${path} → HTTP ${res.status}`
    );
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return res.text();
  return res.json();
}

export const sb = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,

  // ping — HEAD on a small table
  async ping() {
    const res = await fetch(`${BASE}/chat_settings?select=k&limit=1`, {
      method: "GET",
      headers: headers(),
    });
    return { ok: res.ok, status: res.status };
  },

  // ---------- conversations ----------
  async listConversations({ limit = 200, includeArchived = false } = {}) {
    const query = {
      select: "*",
      order: "last_message_at.desc",
      limit,
    };
    if (!includeArchived) query.archived = "eq.false";
    return request("/chat_conversations", { query });
  },

  async getConversation(id) {
    const rows = await request("/chat_conversations", {
      query: { select: "*", id: `eq.${id}`, limit: 1 },
    });
    return rows?.[0] || null;
  },

  async createConversation(payload) {
    const rows = await request("/chat_conversations", {
      method: "POST",
      body: payload,
      prefer: "return=representation",
    });
    return rows?.[0] || null;
  },

  async updateConversation(id, patch) {
    const rows = await request("/chat_conversations", {
      method: "PATCH",
      query: { id: `eq.${id}` },
      body: { ...patch, updated_at: new Date().toISOString() },
      prefer: "return=representation",
    });
    return rows?.[0] || null;
  },

  async deleteConversation(id) {
    await request("/chat_conversations", {
      method: "DELETE",
      query: { id: `eq.${id}` },
    });
  },

  // ---------- messages ----------
  async listMessages(conversationId) {
    return request("/chat_messages", {
      query: {
        select: "*",
        conversation_id: `eq.${conversationId}`,
        order: "seq.asc,created_at.asc",
      },
    });
  },

  async insertMessage(payload) {
    const rows = await request("/chat_messages", {
      method: "POST",
      body: payload,
      prefer: "return=representation",
    });
    return rows?.[0] || null;
  },

  async updateMessage(id, patch) {
    const rows = await request("/chat_messages", {
      method: "PATCH",
      query: { id: `eq.${id}` },
      body: { ...patch, updated_at: new Date().toISOString() },
      prefer: "return=representation",
    });
    return rows?.[0] || null;
  },

  async deleteMessage(id) {
    await request("/chat_messages", {
      method: "DELETE",
      query: { id: `eq.${id}` },
    });
  },

  async deleteMessagesAfter(conversationId, seq) {
    await request("/chat_messages", {
      method: "DELETE",
      query: {
        conversation_id: `eq.${conversationId}`,
        seq: `gt.${seq}`,
      },
    });
  },

  // ---------- models ----------
  async listModels({ onlyFree = false, onlyEnabled = false } = {}) {
    const query = {
      select: "*",
      order: "sort_index.asc, id.asc",
    };
    if (onlyFree) query.is_free = "eq.true";
    if (onlyEnabled) query.enabled = "eq.true";
    return request("/chat_models", { query });
  },

  async upsertModels(list) {
    if (!list || !list.length) return [];
    // Chunk to keep URLs sane
    const chunkSize = 120;
    let all = [];
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      const rows = await request("/chat_models", {
        method: "POST",
        body: chunk,
        prefer: "resolution=merge-duplicates,return=representation",
        extraHeaders: { "Prefer": "resolution=merge-duplicates,return=representation" },
      });
      if (Array.isArray(rows)) all = all.concat(rows);
    }
    return all;
  },

  async updateModel(id, patch) {
    const rows = await request("/chat_models", {
      method: "PATCH",
      query: { id: `eq.${id}` },
      body: { ...patch, updated_at: new Date().toISOString() },
      prefer: "return=representation",
    });
    return rows?.[0] || null;
  },

  // ---------- settings ----------
  async getSetting(k, fallback = null) {
    try {
      const rows = await request("/chat_settings", {
        query: { select: "*", k: `eq.${k}`, limit: 1 },
      });
      if (rows && rows[0]) return rows[0].v;
      return fallback;
    } catch {
      return fallback;
    }
  },

  async setSetting(k, v) {
    try {
      await request("/chat_settings", {
        method: "POST",
        body: { k, v, updated_at: new Date().toISOString() },
        prefer: "resolution=merge-duplicates,return=minimal",
        extraHeaders: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      });
    } catch (e) {
      // Silently ignore — this is just a convenience.
      console.warn("[settings] set failed", e);
    }
  },
};
