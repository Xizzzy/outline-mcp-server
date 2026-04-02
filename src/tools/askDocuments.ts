import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getDefaultCollectionId } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('ask_documents', {
  name: 'ask_documents',
  description:
    'Query documents with natural language. This method allows asking direct questions of your documents - where possible an answer will be provided. Search results will be restricted to those accessible by the current access token. Note that "AI answers" must be enabled for the workspace.',
  inputSchema: {
    query: z.string().describe('The natural language query to ask about your documents'),
    userId: z
      .string()
      .describe(
        'Any documents that have not been edited by the user identifier will be filtered out'
      )
      .optional(),
    collectionId: z.string().describe('A collection to search within').optional(),
    documentId: z.string().describe('A document to search within').optional(),
    statusFilter: z
      .enum(['draft', 'archived', 'published'])
      .describe('Any documents that are not in the specified status will be filtered out')
      .optional(),
    dateFilter: z
      .enum(['day', 'week', 'month', 'year'])
      .describe(
        'Any documents that have not been updated within the specified period will be filtered out'
      )
      .optional(),
  },
  async callback(args) {
    try {
      const payload: Record<string, any> = {
        query: args.query,
      };

      if (args.userId) {
        payload.userId = args.userId;
      }

      const collectionId = args.collectionId || getDefaultCollectionId();
      if (collectionId) {
        payload.collectionId = collectionId;
      }

      if (args.documentId) {
        payload.documentId = args.documentId;
      }

      if (args.statusFilter) {
        payload.statusFilter = args.statusFilter;
      }

      if (args.dateFilter) {
        payload.dateFilter = args.dateFilter;
      }

      const client = getOutlineClient();
      const response = await client.post('/documents.answerQuestion', payload);
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error asking documents:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
