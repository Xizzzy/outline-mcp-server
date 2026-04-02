import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getDefaultCollectionId } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('create_document', {
  name: 'create_document',
  description: 'Create a new document',
  inputSchema: {
    title: z.string().describe('Title of the document'),
    text: z.string().describe('Content of the document in markdown format'),
    collectionId: z.string().describe('ID of the collection to add the document to').optional(),
    parentDocumentId: z
      .string()
      .describe('ID of the parent document (if creating a nested document)')
      .optional(),
    publish: z.boolean().describe('Whether to publish the document immediately').optional(),
    template: z.boolean().describe('Whether this document is a template').optional(),
  },
  async callback(args) {
    try {
      const collectionId = args.collectionId || getDefaultCollectionId();
      if (!collectionId) {
        throw new Error('collectionId is required — pass it explicitly or set OUTLINE_COLLECTION_ID');
      }
      const payload: Record<string, any> = {
        title: args.title,
        text: args.text,
        collectionId,
      };

      if (args.parentDocumentId) {
        payload.parentDocumentId = args.parentDocumentId;
      }

      if (args.publish !== undefined) {
        payload.publish = args.publish ?? true;
      }

      if (args.template !== undefined) {
        payload.template = args.template;
      }

      const client = getOutlineClient();
      const response = await client.post('/documents.create', payload);
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error creating document:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
