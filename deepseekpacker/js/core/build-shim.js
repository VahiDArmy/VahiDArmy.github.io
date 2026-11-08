// Re-export buildZip so modules that only need it do not pull in the whole zip-build namespace.
export { buildZip } from './zip-build.js';
