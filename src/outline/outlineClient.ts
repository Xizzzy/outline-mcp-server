import axios, { AxiosInstance } from 'axios';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { RequestContext } from '../utils/toolRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env'), quiet: true });

const API_URL = process.env.OUTLINE_API_URL || 'https://app.getoutline.com/api';

/**
 * Creates an Outline API client with the specified API key
 */
export function createOutlineClient(apiKey?: string): AxiosInstance {
  const key = apiKey || process.env.OUTLINE_API_KEY;

  if (!key) {
    throw new Error('OUTLINE_API_KEY must be provided either as parameter or environment variable');
  }

  return axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

/**
 * Gets an outline client using context API key first, then environment variable
 */
export function getOutlineClient(): AxiosInstance {
  const context = RequestContext.getInstance();
  const contextApiKey = context.getApiKey();

  if (contextApiKey) {
    return createOutlineClient(contextApiKey);
  }

  return createOutlineClient();
}

/**
 * Gets the default outline client using environment variable
 * Only validates when called, not on import
 */
export function getDefaultOutlineClient(): AxiosInstance {
  return createOutlineClient();
}

/**
 * Parses OUTLINE_COLLECTION_ID env var.
 * Supports a single ID or comma-separated list of IDs.
 * Returns undefined when not set (no filtering).
 */
function parseCollectionIds(): string[] | undefined {
  const raw = process.env.OUTLINE_COLLECTION_ID;
  if (!raw) return undefined;
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/**
 * Gets the default collection ID for tools that accept a single collectionId.
 * When multiple IDs are configured, returns the first one.
 * When not set, returns undefined (no filtering).
 */
export function getDefaultCollectionId(): string | undefined {
  const ids = parseCollectionIds();
  return ids?.[0];
}

/**
 * Gets all allowed collection IDs from OUTLINE_COLLECTION_ID env var.
 * Returns undefined when not set (all collections allowed).
 */
export function getAllowedCollectionIds(): string[] | undefined {
  return parseCollectionIds();
}

/**
 * Default client instance for backward compatibility
 * Note: This will only validate API key when first accessed, not on import
 */
let _defaultClient: AxiosInstance | null = null;
export const outlineClient = new Proxy({} as AxiosInstance, {
  get(target, prop) {
    if (!_defaultClient) {
      _defaultClient = getDefaultOutlineClient();
    }
    const value = _defaultClient[prop as keyof AxiosInstance];
    return typeof value === 'function' ? value.bind(_defaultClient) : value;
  },
});
