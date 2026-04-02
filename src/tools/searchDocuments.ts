import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getDefaultCollectionId, getAllowedCollectionIds } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('search_documents', {
  name: 'search_documents',
  description: 'Search for documents in the Outline workspace',
  inputSchema: {
    query: z.string().describe('Search query to filter documents'),
    collectionId: z.string().describe('Filter by collection ID').optional(),
    limit: z.number().describe('Maximum number of documents to return').optional(),
    offset: z.number().describe('Pagination offset').optional(),
    snippetMinWords: z
      .number()
      .describe('Minimum number of words in the search snippet (default 20)')
      .optional(),
    snippetMaxWords: z
      .number()
      .describe('Maximum number of words in the search snippet (default 30)')
      .optional(),
    statusFilter: z
      .array(z.enum(['published', 'archived', 'draft']))
      .describe('Filter by document status')
      .optional(),
    dateFilter: z
      .enum(['day', 'week', 'month', 'year'])
      .describe('Filter by date range')
      .optional(),
    sort: z
      .enum(['createdAt', 'updatedAt', 'title', 'relevance'])
      .describe('Field to sort results by')
      .optional(),
    direction: z
      .enum(['ASC', 'DESC'])
      .describe('Sort direction')
      .optional(),
  },
  async callback(args) {
    try {
      const basePayload: Record<string, any> = {
        query: args.query,
      };

      if (args.limit !== undefined) basePayload.limit = args.limit;
      if (args.offset !== undefined) basePayload.offset = args.offset;
      if (args.snippetMinWords !== undefined) basePayload.snippetMinWords = args.snippetMinWords;
      if (args.snippetMaxWords !== undefined) basePayload.snippetMaxWords = args.snippetMaxWords;
      if (args.statusFilter) basePayload.statusFilter = args.statusFilter;
      if (args.dateFilter) basePayload.dateFilter = args.dateFilter;
      if (args.sort) basePayload.sort = args.sort;
      if (args.direction) basePayload.direction = args.direction;

      const client = getOutlineClient();

      const collectionIds = args.collectionId
        ? [args.collectionId]
        : getAllowedCollectionIds();

      const mapResults = (data: any[]) =>
        data.map((item: any) => {
          const { id, title, url, collectionId, parentDocumentId, createdAt, updatedAt } = item.document;
          return {
            context: item.context,
            ranking: item.ranking,
            document: { id, title, url, collectionId, parentDocumentId, createdAt, updatedAt },
          };
        });

      if (!collectionIds || collectionIds.length <= 1) {
        const payload = { ...basePayload };
        const id = collectionIds?.[0] || getDefaultCollectionId();
        if (id) payload.collectionId = id;

        const response = await client.post('/documents.search', payload);
        return {
          content: [
            { type: 'text', text: `documents: ${JSON.stringify(mapResults(response.data.data))}` },
            { type: 'text', text: `pagination: ${JSON.stringify(response.data.pagination)}` },
          ],
        };
      }

      // Multiple collections — parallel requests, merge by ranking
      const responses = await Promise.all(
        collectionIds.map(id =>
          client.post('/documents.search', { ...basePayload, collectionId: id })
        )
      );

      const allResults = responses.flatMap(r => mapResults(r.data.data));
      allResults.sort((a: any, b: any) => (b.ranking ?? 0) - (a.ranking ?? 0));

      const limit = basePayload.limit || 25;
      const limited = allResults.slice(0, limit);
      return {
        content: [
          { type: 'text', text: `documents: ${JSON.stringify(limited)}` },
          { type: 'text', text: `pagination: ${JSON.stringify({ limit, offset: basePayload.offset ?? 0, total: allResults.length })}` },
        ],
      };
    } catch (error: any) {
      console.error('Error searching documents:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
