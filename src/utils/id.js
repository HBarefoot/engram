import { randomUUID } from 'crypto';

/**
 * Generate a new UUIDv4
 * @returns {string} A new UUID
 */
export function generateId() {
  return randomUUID();
}
