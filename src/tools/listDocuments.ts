import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getDefaultCollectionId, getAllowedCollectionIds } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('list_documents', {
  name: 'list_documents',
  description: 'List documents in the Outline workspace with optional filters',
  inputSchema: {
    collectionId: z.string().describe('Filter by collection ID (optional)').optional(),
    limit: z.number().describe('Maximum number of documents to return (optional)').optional(),
    offset: z.number().describe('Pagination offset (optional)').optional(),
    sort: z.string().describe('Field to sort by (e.g. "updatedAt") (optional)').optional(),
    direction: z
      .enum(['ASC', 'DESC'])
      .describe('Sort direction, either "ASC" or "DESC" (optional)')
      .optional(),
    template: z.boolean().describe('Optionally filter to only templates (optional)').optional(),
    userId: z.string().describe('Optionally filter by user ID (optional)').optional(),
    parentDocumentId: z
      .string()
      .describe('Optionally filter by parent document ID (optional)')
      .optional(),
    backlinkDocumentId: z
      .string()
      .describe('Optionally filter by backlink document ID (optional)')
      .optional(),
  },
  async callback(args) {
    try {
      const basePayload: Record<string, any> = {
        offset: args.offset ?? 0,
        limit: args.limit || 25,
        sort: args.sort || 'updatedAt',
        direction: args.direction || 'DESC',
      };

      if (args.template !== undefined) {
        basePayload.template = args.template;
      }
      if (args.userId) {
        basePayload.userId = args.userId;
      }
      if (args.backlinkDocumentId) {
        basePayload.backlinkDocumentId = args.backlinkDocumentId;
      }
      if (args.parentDocumentId) {
        basePayload.parentDocumentId = args.parentDocumentId;
      }

      const client = getOutlineClient();

      // Determine which collections to query
      const collectionIds = args.collectionId
        ? [args.collectionId]
        : getAllowedCollectionIds();

      if (!collectionIds || collectionIds.length <= 1) {
        // Single collection or no filter — one request
        const payload = { ...basePayload };
        const id = collectionIds?.[0] || getDefaultCollectionId();
        if (id) payload.collectionId = id;

        const response = await client.post('/documents.list', payload);
        return {
          content: [
            { type: 'text', text: `documents: ${JSON.stringify(response.data.data)}` },
            { type: 'text', text: `pagination: ${JSON.stringify(response.data.pagination)}` },
          ],
        };
      }

      // Multiple collections — parallel requests, merge results
      const responses = await Promise.all(
        collectionIds.map(id =>
          client.post('/documents.list', { ...basePayload, collectionId: id })
        )
      );

      const allDocs = responses.flatMap(r => r.data.data);
      const sortField = basePayload.sort;
      const dir = basePayload.direction === 'ASC' ? 1 : -1;
      allDocs.sort((a: any, b: any) => {
        const va = a[sortField] ?? '';
        const vb = b[sortField] ?? '';
        return va < vb ? -dir : va > vb ? dir : 0;
      });

      const limited = allDocs.slice(0, basePayload.limit);
      return {
        content: [
          { type: 'text', text: `documents: ${JSON.stringify(limited)}` },
          { type: 'text', text: `pagination: ${JSON.stringify({ limit: basePayload.limit, offset: basePayload.offset, total: allDocs.length })}` },
        ],
      };
    } catch (error: any) {
      console.error('Error listing documents:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
