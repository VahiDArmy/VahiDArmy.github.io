# DevSpace — Essentials Tracker

Living checklist derived from the product vision.  
**E** = essential for the core experience · **U** = useful · **O** = optional/later

Status: ✅ done · 🔧 partial · ⬜ not started

## 1. Core workspace
| # | Item | Pri | Status |
|---|------|-----|--------|
| 1.1 | Browser-only SPA, no local server | E | ✅ |
| 1.2 | Mobile-first chat UI | E | ✅ |
| 1.3 | Project create / list / open | E | ✅ |
| 1.4 | Persistent projects (Supabase + RLS) | E | ✅ |
| 1.5 | Session continuity (messages, last project) | E | ✅ |
| 1.6 | Interruption checkpoints | E | ✅ |
| 1.7 | Cross-device: guide reconnect when files missing | E | 🔧 |

## 2. Real file interaction
| # | Item | Pri | Status |
|---|------|-----|--------|
| 2.1 | Read / write / edit / list / search / tree tools | E | ✅ |
| 2.2 | Write verification (re-read after write) | E | ✅ |
| 2.3 | ZIP import / export | E | ✅ |
| 2.4 | File System Access API when available | U | ✅ |
| 2.5 | Virtual tree survives reload (IndexedDB) | E | ✅ |
| 2.6 | Destructive-op safeguards (confirm delete) | E | 🔧 |
| 2.7 | Binary / large-file handling policy | U | 🔧 |

## 3. Agent reliability
| # | Item | Pri | Status |
|---|------|-----|--------|
| 3.1 | App-owned multi-step tool loop | E | ✅ |
| 3.2 | Models as replaceable workers | E | ✅ |
| 3.3 | Tool-calling fallback for weak models | E | ✅ |
| 3.4 | Activity log (not flooding chat) | E | ✅ |
| 3.5 | Stop / abort mid-run | E | ✅ |
| 3.6 | Retry failed tool once | E | ✅ |
| 3.7 | Task states: planned / in-progress / verified / failed / blocked | E | 🔧 |
| 3.8 | Auto model switch on repeated failure | U | ⬜ |

## 4. Project understanding
| # | Item | Pri | Status |
|---|------|-----|--------|
| 4.1 | Project memory structure (purpose, arch, issues…) | E | ✅ schema |
| 4.2 | Agent can update memory via tool | E | ✅ |
| 4.3 | Roadmap display | E | ✅ |
| 4.4 | Agent can update roadmap via tool | E | ✅ |
| 4.5 | Memory never overrides actual files | E | ✅ (prompt) |
| 4.6 | Smart context packing (relevant files only) | E | 🔧 basic |

## 5. Models & config
| # | Item | Pri | Status |
|---|------|-----|--------|
| 5.1 | OpenRouter integration | E | ✅ |
| 5.2 | Model registry + periodic sync | E | ✅ |
| 5.3 | User activate/deactivate preserved on sync | E | ✅ |
| 5.4 | Settings for keys (client-side, documented limits) | E | ✅ |
| 5.5 | Default model selection | E | ✅ |

## 6. UX / polish
| # | Item | Pri | Status |
|---|------|-----|--------|
| 6.1 | Empty states / first-run guidance | E | ✅ |
| 6.2 | File viewer | U | ✅ |
| 6.3 | Export always available (portability) | E | ✅ |
| 6.4 | PWA manifest | O | ✅ basic |

---

**Last sprint** → 4.2, 4.4, 3.6, 6.1, 2.6(partial)

**Next sprint focus** → 3.7 task states UI, 4.6 better context packing, 2.6 full confirm for delete, 1.7 cross-device reconnect flow
