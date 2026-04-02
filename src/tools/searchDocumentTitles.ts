import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getDefaultCollectionId } from '../outline/outlineClient.js';
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

      const client = getOutlineClient();
      const response = await client.post('/documents.search_titles', payload);

      const results = response.data.data.map((item: any) => {
        const { id, title, url, collectionId, parentDocumentId, createdAt, updatedAt } = item;
        return { id, title, url, collectionId, parentDocumentId, createdAt, updatedAt };
      });

      return {
        content: [
          { type: 'text', text: `documents: ${JSON.stringify(results)}` },
          { type: 'text', text: `pagination: ${JSON.stringify(response.data.pagination)}` },
        ],
      };
    } catch (error: any) {
      console.error('Error searching document titles:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
