import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, assertDocumentAllowed } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('create_comment', {
  name: 'create_comment',
  description: 'Create a new comment on a document',
  inputSchema: {
    documentId: z.string().describe('ID of the document to comment on'),
    text: z.string().describe('Content of the comment in markdown format'),
    parentCommentId: z
      .string()
      .describe('ID of the parent comment (if replying to a comment)')
      .optional(),
    data: z.object({}).describe('Additional data for the comment (optional)').optional(),
  },
  async callback(args) {
    try {
      await assertDocumentAllowed(args.documentId);
      const payload: Record<string, any> = {
        documentId: args.documentId,
        text: args.text,
      };

      if (args.parentCommentId) {
        payload.parentCommentId = args.parentCommentId;
      }

      if (args.data) {
        payload.data = args.data;
      }

      const client = getOutlineClient();
      const response = await client.post('/comments.create', payload);
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error creating comment:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
