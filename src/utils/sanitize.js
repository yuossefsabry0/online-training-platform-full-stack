'use strict';

// Input sanitization helpers. Zod handles types/formats; these scrub content.
// SQL injection is structurally impossible: Prisma parameterizes every query.

// Strip HTML tags & control chars - kills stored/reflected XSS vectors.
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<[^>]*>/g, '') 
    .replace(/[\u0000-\u001F\u007F]/g, '') 
    .trim();
}

// Deep-walk an object/array/string and sanitize every string leaf.
function sanitizeDeep(value) {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v);
    return out;
  }
  return value;
}

module.exports = { sanitizeString, sanitizeDeep };
