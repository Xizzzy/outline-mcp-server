import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, assertDocumentAllowed } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('get_document', {
  name: 'get_document',
  description: 'Get details about a specific document. At least id XOR shareId are required.',
  inputSchema: {
    id: z
      .string()
      .describe('Unique identifier for the document. Either the UUID or the urlId is acceptable'),
  },
  async callback(args) {
    try {
      const doc = await assertDocumentAllowed(args.id);
      if (doc) {
        return { content: [{ type: 'text', text: JSON.stringify(doc) }] };
      }
      const client = getOutlineClient();
      const response = await client.post('/documents.info', { id: args.id });
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error getting document:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
