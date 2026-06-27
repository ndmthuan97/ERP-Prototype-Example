/**
 * E2E Test — Seed Helper
 *
 * Reads seed data from file created by globalSetup.
 * Sets up API token for the test suite.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as api from './api';

const SEED_FILE = path.join(__dirname, '..', '.seed-data.json');

export interface SeedData {
  accessToken: string;
  refreshToken: string;
  customerId: string;
  productA: { id: string; sku: string; name: string };
  productB: { id: string; sku: string; name: string };
  stockItemA: { id: string; sku: string };
  stockItemB: { id: string; sku: string };
  supplierId: string;
}

let _seedData: SeedData | null = null;

export function getSeedData(): SeedData {
  if (!_seedData) {
    throw new Error('Seed data not loaded. Call seedTestData() first.');
  }
  return _seedData;
}

/**
 * Load seed data from file (created by globalSetup) and set API token.
 * No API calls made — just reads file + sets cached token.
 */
export async function seedTestData(): Promise<SeedData> {
  if (_seedData) {
    // Ensure token is set even if module was re-loaded
    api.setAccessToken(_seedData.accessToken);
    return _seedData;
  }

  if (!fs.existsSync(SEED_FILE)) {
    throw new Error(
      `Seed file not found at ${SEED_FILE}. ` +
      `Ensure globalSetup ran successfully.`,
    );
  }

  _seedData = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
  api.setAccessToken(_seedData!.accessToken);
  // Set refresh token in globalThis so api.refresh() works
  (globalThis as any).__E2E_REFRESH_TOKEN__ = _seedData!.refreshToken;
  return _seedData!;
}

export function clearSeedData(): void {
  _seedData = null;
}
