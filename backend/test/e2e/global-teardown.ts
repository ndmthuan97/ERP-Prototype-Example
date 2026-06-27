/**
 * Jest Global Teardown — cleanup after all tests.
 */
import * as fs from 'fs';
import * as path from 'path';

const SEED_FILE = path.join(__dirname, '.seed-data.json');

module.exports = async function globalTeardown() {
  if (fs.existsSync(SEED_FILE)) {
    fs.unlinkSync(SEED_FILE);
  }
};
