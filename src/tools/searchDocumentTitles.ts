import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getDefaultCollectionId, getAllowedCollectionIds } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('search_document_titles', {
  name: 'search_document_titles',
  description:
    'Search for document titles in the Outline workspace. Returns only titles and IDs for a lightweight search.',
  inputSchema: {
    query: z.string().describe('Search query to filter documents by title'),
    collectionId: z.string().describe('Filter by collection ID').optional(),
    limit: z.number().describe('Maximum number of results to return').optional(),
    offset: z.number().describe('Pagination offset').optional(),
  },
  async callback(args) {
    try {
      const basePayload: Record<string, any> = {
        query: args.query,
      };
      if (args.limit !== undefined) basePayload.limit = args.limit;
      if (args.offset !== undefined) basePayload.offset = args.offset;

      const client = getOutlineClient();

      const collectionIds = args.collectionId
        ? [args.collectionId]
        : getAllowedCollectionIds();

      const mapResults = (data: any[]) =>
        data.map((item: any) => {
          const { id, title, url, collectionId, parentDocumentId, createdAt, updatedAt } = item;
          return { id, title, url, collectionId, parentDocumentId, createdAt, updatedAt };
        });

      if (!collectionIds || collectionIds.length <= 1) {
        const payload = { ...basePayload };
        const id = collectionIds?.[0] || getDefaultCollectionId();
        if (id) payload.collectionId = id;

        const response = await client.post('/documents.search_titles', payload);
        return {
          content: [
            { type: 'text', text: `documents: ${JSON.stringify(mapResults(response.data.data))}` },
            { type: 'text', text: `pagination: ${JSON.stringify(response.data.pagination)}` },
          ],
        };
      }

      const responses = await Promise.all(
        collectionIds.map(id =>
          client.post('/documents.search_titles', { ...basePayload, collectionId: id })
        )
      );

      const allResults = responses.flatMap(r => mapResults(r.data.data));
      const limit = basePayload.limit || 25;
      const limited = allResults.slice(0, limit);
      return {
        content: [
          { type: 'text', text: `documents: ${JSON.stringify(limited)}` },
          { type: 'text', text: `pagination: ${JSON.stringify({ limit, offset: basePayload.offset ?? 0, total: allResults.length })}` },
        ],
      };
    } catch (error: any) {
      console.error('Error searching document titles:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
