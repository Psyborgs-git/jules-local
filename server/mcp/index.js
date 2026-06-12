import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { julesRequest } from '../jules.js';

// Store active MCP transports and servers mapping sessionId -> { transport, server }
const activeConnections = {};

const createJulesMcpServer = () => {
  const mcpServer = new McpServer(
    {
      name: 'jules-mcp-server',
      version: '1.0.0'
    },
    { capabilities: { logging: {}, prompts: {}, resources: {}, tools: {} } }
  );

  mcpServer.registerTool(
    'list_sources',
    {
      description: 'List available sources (repositories)',
      inputSchema: z.object({
        pageSize: z.number().optional().describe('Number of items to return'),
        pageToken: z.string().optional().describe('Page token for pagination'),
        filter: z.string().optional().describe('Filter string for the sources')
      })
    },
    async (args) => {
      let path = '/sources';
      const query = new URLSearchParams();
      if (args.pageSize) query.append('pageSize', args.pageSize.toString());
      if (args.pageToken) query.append('pageToken', args.pageToken);
      if (args.filter) query.append('filter', args.filter);

      const queryString = query.toString();
      if (queryString) path += `?${queryString}`;

      try {
        const data = await julesRequest(path);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  mcpServer.registerTool(
    'create_session',
    {
      description: 'Create a new Jules session',
      inputSchema: z.object({
        sourceId: z.string().describe('ID of the source repository'),
        initialMessage: z.string().describe('Initial prompt/message to start the session')
      })
    },
    async (args) => {
      try {
        const body = {
          sourceId: args.sourceId,
          message: { userMessage: args.initialMessage }
        };
        const data = await julesRequest('/sessions', 'POST', body);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  mcpServer.registerTool(
    'get_session',
    {
      description: 'Get details of a session',
      inputSchema: z.object({
        sessionId: z.string().describe('ID of the session')
      })
    },
    async (args) => {
      try {
        const data = await julesRequest(`/sessions/${args.sessionId}`);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  mcpServer.registerTool(
    'get_activities',
    {
      description: 'Get activities for a session',
      inputSchema: z.object({
        sessionId: z.string().describe('ID of the session')
      })
    },
    async (args) => {
      try {
        const data = await julesRequest(`/sessions/${args.sessionId}/activities`);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  mcpServer.registerTool(
    'send_message',
    {
      description: 'Send a message to a session',
      inputSchema: z.object({
        sessionId: z.string().describe('ID of the session'),
        message: z.string().describe('The message to send')
      })
    },
    async (args) => {
      try {
        const body = { userMessage: args.message };
        const data = await julesRequest(`/sessions/${args.sessionId}:sendMessage`, 'POST', body);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  mcpServer.registerTool(
    'approve_plan',
    {
      description: 'Approve a plan for a session',
      inputSchema: z.object({
        sessionId: z.string().describe('ID of the session')
      })
    },
    async (args) => {
      try {
        const data = await julesRequest(`/sessions/${args.sessionId}:approvePlan`, 'POST', {});
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  return mcpServer;
};

export const setupMcpServer = (app) => {
  app.get('/mcp', async (req, res) => {
    try {
      const transport = new SSEServerTransport('/mcp/messages', res);
      const sessionId = transport.sessionId;
      const mcpServer = createJulesMcpServer();

      activeConnections[sessionId] = { transport, server: mcpServer };

      transport.onclose = () => {
        delete activeConnections[sessionId];
      };

      await mcpServer.connect(transport);
      console.log(`MCP client connected (Session ID: ${sessionId})`);
    } catch (err) {
      console.error('Error establishing MCP SSE stream:', err);
      if (!res.headersSent) {
        res.status(500).send('Error establishing MCP SSE stream');
      }
    }
  });

  app.post('/mcp/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(400).send('Missing sessionId parameter');
    }

    const connection = activeConnections[sessionId];
    if (!connection || !connection.transport) {
      return res.status(404).send('Session not found');
    }

    try {
      await connection.transport.handlePostMessage(req, res, req.body);
    } catch (err) {
      console.error('Error handling MCP request:', err);
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  });
};

export const broadcastMcpNotification = (method, params) => {
  const notificationMessage = {
    jsonrpc: '2.0',
    method: method,
    params: params
  };

  for (const sessionId of Object.keys(activeConnections)) {
    try {
      const transport = activeConnections[sessionId].transport;
      transport.send(notificationMessage).catch(err => {
        console.error(`Error sending MCP notification to session ${sessionId}:`, err);
      });
    } catch (err) {
      console.error(`Error initiating MCP notification to session ${sessionId}:`, err);
    }
  }
};
