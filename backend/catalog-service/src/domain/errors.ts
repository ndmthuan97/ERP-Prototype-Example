// =============================================================================
// DOMAIN ERRORS — Catalog-specific business rule violations
// =============================================================================

export class DuplicateSkuError extends Error {
  constructor(sku: string) {
    super(`SKU "${sku}" already exists in the catalog`);
    this.name = "DuplicateSkuError";
  }
}

export class InactiveProductError extends Error {
  constructor(id: string) {
    super(`Product "${id}" is inactive and cannot be modified`);
    this.name = "InactiveProductError";
  }
}
