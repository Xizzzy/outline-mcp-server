import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getAllowedCollectionIds } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('create_collection', {
  name: 'create_collection',
  description: 'Create a new collection',
  inputSchema: {
    name: z.string().describe('Title of the collection'),
    description: z.string().describe('Content of the collection in markdown format').optional(),
    permission: z
      .enum(['read', 'read_write'])
      .describe('Permission level for the collection')
      .optional(),
    color: z.string().describe('Hex color code for the collection').optional(),
    private: z.boolean().describe('Whether this collection is private').optional(),
  },
  async callback(args) {
    try {
      if (getAllowedCollectionIds()) {
        throw new Error('Access denied: cannot create collections when OUTLINE_COLLECTION_ID is set');
      }
      const payload: Record<string, any> = {
        name: args.name,
      };

      if (args.description !== undefined) {
        payload.description = args.description;
      }

      if (args.permission !== undefined) {
        payload.permission = args.permission;
      }

      if (args.color !== undefined) {
        payload.color = args.color;
      }

      if (args.private !== undefined) {
        payload.private = args.private;
      }

      const client = getOutlineClient();
      const response = await client.post('/collections.create', payload);
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error creating collection:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
