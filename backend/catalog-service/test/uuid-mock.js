// =============================================================================
// MOCK uuid for Jest — uuid v14 is ESM-only, jest-runtime (CJS) cannot parse it
// =============================================================================

let counter = 0;

function v4() {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

module.exports = { v4 };
