// =============================================================================
// uuid shim cho INTEGRATION test — trả uuid THẬT (ngẫu nhiên, duy nhất)
// =============================================================================
// uuid v14 là ESM-only → jest-runtime (CJS) không parse được. Unit test dùng
// uuid-mock.js (counter, deterministic). Integration test chạy trên DB thật nên
// cần id DUY NHẤT mỗi lần (tránh đụng PK outbox giữa các lần chạy) → dùng
// node:crypto.randomUUID().

const { randomUUID } = require('node:crypto');

module.exports = { v4: () => randomUUID() };
