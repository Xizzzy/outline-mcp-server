import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, assertDocumentAllowed } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import { z } from 'zod';

// Register this tool
toolRegistry.register('archive-document', {
  name: 'archive_document',
  description: 'Archive a document',
  inputSchema: {
    id: z.string().describe('ID of the document to archive'),
  },
  async callback(args) {
    try {
      await assertDocumentAllowed(args.id);
      const client = getOutlineClient();
      const response = await client.post('/documents.archive', {
        id: args.id,
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error archiving document:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
