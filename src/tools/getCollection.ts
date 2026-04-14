import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getOutlineClient, assertCollectionAllowed, resolveCollectionRef } from '../outline/outlineClient.js';
import toolRegistry from '../utils/toolRegistry.js';
import z from 'zod';

// Register this tool
toolRegistry.register('get_collection', {
  name: 'get_collection',
  description: 'Get details about a specific collection',
  inputSchema: {
    id: z.string().describe('ID of the collection to retrieve'),
  },
  async callback(args) {
    try {
      const id = await resolveCollectionRef(args.id);
      await assertCollectionAllowed(id);
      const client = getOutlineClient();
      const response = await client.post(`/collections.info`, { id });
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data) }] };
    } catch (error: any) {
      console.error('Error getting collection:', error.message);
      throw new McpError(ErrorCode.InvalidRequest, error.message);
    }
  },
});
