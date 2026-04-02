import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getDefaultCollectionId } from '../outline/outlineClient.js';
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
      const payload: Record<string, any> = {
        query: args.query,
      };

      const collectionId = args.collectionId || getDefaultCollectionId();
      if (collectionId) {
        payload.collectionId = collectionId;
      }
      if (args.limit !== undefined) {
        payload.limit = args.limit;
      }
      if (args.offset !== undefined) {
        payload.offset = args.offset;
      }
      if (args.snippetMinWords !== undefined) {
        payload.snippetMinWords = args.snippetMinWords;
      }
      if (args.snippetMaxWords !== undefined) {
        payload.snippetMaxWords = args.snippetMaxWords;
      }
      if (args.statusFilter) {
        payload.statusFilter = args.statusFilter;
      }
      if (args.dateFilter) {
        payload.dateFilter = args.dateFilter;
      }
      if (args.sort) {
        payload.sort = args.sort;
      }
      if (args.direction) {
        payload.direction = args.direction;
      }

      const client = getOutlineClient();
      const response = await client.post('/documents.search', payload);

      const results = response.data.data.map((item: any) => {
        const { id, title, url, collectionId, parentDocumentId, createdAt, updatedAt } =
          item.document;
        return {
          context: item.context,
          ranking: item.ranking,
          document: { id, title, url, collectionId, parentDocumentId, createdAt, updatedAt },
        };
      });

      return {
        content: [
          { type: 'text', text: `documents: ${JSON.stringify(results)}` },
          { type: 'text', text: `pagination: ${JSON.stringify(response.data.pagination)}` },
        ],
      };
    } catch (error: any) {
      console.error('Error searching documents:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
