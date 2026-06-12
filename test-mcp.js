import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
console.log('McpServer:', !!McpServer);
console.log('SSEServerTransport:', !!SSEServerTransport);
