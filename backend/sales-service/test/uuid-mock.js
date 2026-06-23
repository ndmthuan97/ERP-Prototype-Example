// =============================================================================
// MOCK uuid cho Jest — vì sao cần?
// =============================================================================
// uuid v14 là ESM-only (package.json "type":"module", không có bản CommonJS).
// App chạy được vì Node 24 hỗ trợ require(ESM), nhưng jest-runtime (CJS) thì
// không parse được → SyntaxError. Trong unit test giá trị uuid không quan trọng
// (ta kiểm tra businessName/status, không kiểm tra id), nên mock 1 v4 đơn giản,
// deterministic là đủ. Mapping chỉ áp dụng cho jest (xem moduleNameMapper),
// KHÔNG ảnh hưởng runtime/build thật.

let counter = 0;

/** Sinh uuid giả deterministic theo bộ đếm — đủ dùng cho test */
function v4() {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

module.exports = { v4 };
