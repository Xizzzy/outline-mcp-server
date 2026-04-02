import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, getAllowedCollectionIds } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('list_collections', {
  name: 'list_collections',
  description: 'List all collections in the Outline workspace',
  inputSchema: {
    limit: z.number().describe('Maximum number of collections to return (optional)').optional(),
  },
  async callback(args) {
    try {
      const payload: Record<string, any> = {};

      if (args.limit) {
        payload.limit = args.limit;
      }

      const client = getOutlineClient();
      const response = await client.post('/collections.list', payload);

      const allowed = getAllowedCollectionIds();
      const collections = allowed
        ? response.data.data.filter((c: any) => allowed.includes(c.id))
        : response.data.data;

      return {
        content: [
          {
            type: 'text',
            text: `collections: ${JSON.stringify(collections)}`,
          },
          {
            type: 'text',
            text: `pagination: ${JSON.stringify(response.data.pagination)}`,
          },
        ],
      };
    } catch (error: any) {
      console.error('Error listing collections:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
