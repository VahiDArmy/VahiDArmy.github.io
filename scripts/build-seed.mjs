// Regenerates js/data/seed-models.js from a downloaded OpenRouter catalog.
// Usage: node scripts/build-seed.mjs vendor/openrouter-models.json
import fs from 'node:fs';

const file = process.argv[2] || 'vendor/openrouter-models.json';
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
const num = (v, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);

function map(raw) {
  const id = String(raw.id || '');
  const pricing = raw.pricing || {};
  const pin = num(pricing.prompt);
  const pout = num(pricing.completion);
  const params = Array.isArray(raw.supported_parameters) ? raw.supported_parameters : [];
  const inputs = raw.architecture?.input_modalities || [];
  return {
    id,
    name: raw.name || id,
    provider: id.split('/')[0] || 'unknown',
    description: String(raw.description || '').replace(/\s+/g, ' ').slice(0, 280),
    context_length: num(raw.context_length),
    max_output: num(raw.top_provider?.max_completion_tokens),
    price_in: Math.round(pin * 1e6 * 1e4) / 1e4,
    price_out: Math.round(pout * 1e6 * 1e4) / 1e4,
    is_free: id.endsWith(':free') || (pin === 0 && pout === 0),
    supports_tools: params.includes('tools'),
    supports_images: inputs.includes('image'),
    modality: raw.architecture?.modality || '',
    created_at_remote: num(raw.created),
    raw: { supported_parameters: params, input_modalities: inputs },
  };
}

const mapped = payload.data.map(map);
const free = mapped.filter((m) => m.is_free);
const cheap = mapped
  .filter((m) => !m.is_free && m.supports_tools && m.price_in <= 0.6 && m.context_length >= 32000)
  .sort((a, b) => b.context_length - a.context_length)
  .slice(0, 26);
const seed = [...free, ...cheap].sort((a, b) => a.name.localeCompare(b.name));

const out = `// Generated from the OpenRouter catalog by scripts/build-seed.mjs.
// Only used to bootstrap an empty registry; the live registry comes from sync.
export const SEED_MODELS = ${JSON.stringify(seed, null, 1)};
`;
fs.writeFileSync('js/data/seed-models.js', out);
console.log('seed models:', seed.length, 'free:', free.length, 'bytes:', out.length);
