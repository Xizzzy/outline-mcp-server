import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getDefaultCollectionId } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('move_document', {
  name: 'move_document',
  description: 'Move a document to a different collection or parent document',
  inputSchema: {
    id: z.string().describe('ID of the document to move'),
    collectionId: z
      .string()
      .describe('ID of the collection to move the document to (optional)')
      .optional(),
    parentDocumentId: z
      .string()
      .describe('ID of the parent document to move under (optional)')
      .optional(),
  },
  async callback(args) {
    try {
      const payload: Record<string, any> = {
        id: args.id,
      };

      const collectionId = args.collectionId || getDefaultCollectionId();
      if (collectionId) {
        payload.collectionId = collectionId;
      }

      if (args.parentDocumentId) {
        payload.parentDocumentId = args.parentDocumentId;
      }

      const client = getOutlineClient();
      const response = await client.post('/documents.move', payload);
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error moving document:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
