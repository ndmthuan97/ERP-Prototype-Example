// =============================================================================
// MOCK uuid for Jest
// =============================================================================
// uuid v14 is ESM-only. jest-runtime (CJS) can't parse it.
// In unit tests, uuid values don't matter — we check business logic,
// not id format. Deterministic mock is sufficient.

let counter = 0;

/** Generate deterministic fake uuid for testing */
function v4() {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

module.exports = { v4 };
