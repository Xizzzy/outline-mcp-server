import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, assertDocumentAllowed } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('delete_document', {
  name: 'delete_document',
  description: 'Delete a document',
  inputSchema: {
    id: z.string().describe('ID of the document to delete'),
  },
  async callback(args) {
    try {
      await assertDocumentAllowed(args.id);
      const client = getOutlineClient();
      const response = await client.post('/documents.delete', {
        id: args.id,
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data.success) }] };
    } catch (error: any) {
      console.error('Error deleting document:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
