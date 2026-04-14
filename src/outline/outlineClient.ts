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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Extracts the urlId segment from a collection reference.
 * Accepts either a bare urlId ("VvwEgtUPz1") or a full slug ("meowl-VvwEgtUPz1")
 * as seen in URLs like /collection/<slug>/...
 */
function extractUrlId(ref: string): string {
  const idx = ref.lastIndexOf('-');
  return idx >= 0 ? ref.slice(idx + 1) : ref;
}

/**
 * Parses OUTLINE_COLLECTION_ID env var.
 * Supports a single value or comma-separated list.
 * Entries can be UUIDs, urlIds, or full slugs (title-urlId).
 * Returns undefined when not set.
 */
function parseCollectionIds(): string[] | undefined {
  const raw = process.env.OUTLINE_COLLECTION_ID;
  if (!raw) return undefined;
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

let collectionMapCache: Map<string, string> | undefined;
let collectionMapPromise: Promise<Map<string, string>> | undefined;

/**
 * Lazily fetches and caches a urlId → UUID map for all collections.
 * One paginated /collections.list call on first access; reused afterwards.
 */
async function getCollectionUrlIdMap(): Promise<Map<string, string>> {
  if (collectionMapCache) return collectionMapCache;
  if (collectionMapPromise) return collectionMapPromise;

  collectionMapPromise = (async () => {
    const client = getOutlineClient();
    const map = new Map<string, string>();
    const limit = 100;
    let offset = 0;
    while (true) {
      const response = await client.post('/collections.list', { limit, offset });
      const collections = (response.data.data ?? []) as Array<{ id: string; urlId: string }>;
      for (const c of collections) {
        if (c.urlId) map.set(c.urlId, c.id);
      }
      if (collections.length < limit) break;
      offset += limit;
    }
    collectionMapCache = map;
    return map;
  })();

  try {
    return await collectionMapPromise;
  } finally {
    collectionMapPromise = undefined;
  }
}

/**
 * Resolves a collection reference (UUID, urlId, or slug) to a canonical UUID.
 * UUIDs are returned as-is. Slugs/urlIds are resolved via /collections.list.
 */
export async function resolveCollectionRef(ref: string): Promise<string> {
  if (isUuid(ref)) return ref;
  const urlId = extractUrlId(ref);
  const map = await getCollectionUrlIdMap();
  const uuid = map.get(urlId);
  if (!uuid) {
    throw new Error(
      `Collection "${ref}" not found (urlId="${urlId}" not present in /collections.list)`
    );
  }
  return uuid;
}

let allowedIdsCache: { ids: string[] | undefined } | undefined;
let allowedIdsPromise: Promise<string[] | undefined> | undefined;

/**
 * Gets all allowed collection UUIDs from OUTLINE_COLLECTION_ID.
 * Slugs/urlIds are resolved to UUIDs on first call and cached.
 * Returns undefined when the env var is not set (all collections allowed).
 */
export async function getAllowedCollectionIds(): Promise<string[] | undefined> {
  if (allowedIdsCache) return allowedIdsCache.ids;
  if (allowedIdsPromise) return allowedIdsPromise;

  allowedIdsPromise = (async () => {
    const raw = parseCollectionIds();
    if (!raw) {
      allowedIdsCache = { ids: undefined };
      return undefined;
    }
    const resolved: string[] = [];
    for (const item of raw) {
      resolved.push(await resolveCollectionRef(item));
    }
    allowedIdsCache = { ids: resolved };
    return resolved;
  })();

  try {
    return await allowedIdsPromise;
  } finally {
    allowedIdsPromise = undefined;
  }
}

/**
 * Gets the default collection UUID for tools that accept a single collectionId.
 * When multiple values are configured, returns the first one (resolved to UUID).
 */
export async function getDefaultCollectionId(): Promise<string | undefined> {
  const ids = await getAllowedCollectionIds();
  return ids?.[0];
}

/**
 * Synchronous check: is OUTLINE_COLLECTION_ID set at all?
 * Useful for guards that only need the presence signal, not resolved values.
 */
export function hasCollectionFilter(): boolean {
  return parseCollectionIds() !== undefined;
}

/**
 * Returns true if the given collection reference (UUID, urlId, or slug)
 * resolves to an allowed UUID.
 */
export async function isCollectionAllowed(ref: string): Promise<boolean> {
  const allowed = await getAllowedCollectionIds();
  if (!allowed) return true;
  const uuid = await resolveCollectionRef(ref);
  return allowed.includes(uuid);
}

/**
 * Throws if the given collection reference is not in the allowed list.
 */
export async function assertCollectionAllowed(ref: string): Promise<void> {
  if (!(await isCollectionAllowed(ref))) {
    throw new Error(
      `Access denied: collection ${ref} is not in OUTLINE_COLLECTION_ID`
    );
  }
}

/**
 * Fetches a document and throws if it belongs to a collection outside the allowed list.
 * Returns the document data for reuse.
 */
export async function assertDocumentAllowed(documentId: string): Promise<any> {
  const allowed = await getAllowedCollectionIds();
  if (!allowed) return;

  const client = getOutlineClient();
  const response = await client.post('/documents.info', { id: documentId });
  const doc = response.data.data;
  if (!allowed.includes(doc.collectionId)) {
    throw new Error(
      `Access denied: document belongs to collection ${doc.collectionId} which is not in OUTLINE_COLLECTION_ID`
    );
  }
  return doc;
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
