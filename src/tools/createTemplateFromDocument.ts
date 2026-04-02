import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, assertDocumentAllowed } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('create_template_from_document', {
  name: 'create_template_from_document',
  description:
    'Create a template from an existing document. This method allows you to create a new template using an existing document as the basis.',
  inputSchema: {
    id: z.string().describe('The ID of the document to use as a basis for the template'),
  },
  async callback(args) {
    try {
      await assertDocumentAllowed(args.id);
      const payload = {
        id: args.id,
      };

      const client = getOutlineClient();
      const response = await client.post('/documents.templatize', payload);
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error creating template from document:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
