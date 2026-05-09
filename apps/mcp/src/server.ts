import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { redact } from '@keynv/redactor';
import { parseAlias } from '@keynv/core';
import { McpApiClient } from './api-client.js';
import type { Credentials } from './credentials.js';
import { issueReferenceToken } from './tokens.js';

interface ServerDeps {
  creds: Credentials;
}

const TOOLS = [
  {
    name: 'keynv.who_am_i',
    description:
      'Returns the user identity and project memberships available to this MCP session.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'keynv.list_secrets',
    description:
      'Lists alias names visible in the named project. Never returns secret values, only aliases.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name (kebab-case).' },
      },
      required: ['project'],
      additionalProperties: false,
    },
  },
  {
    name: 'keynv.use_secret',
    description:
      'Returns a single-use reference token bound to an alias. Tokens expire in 60s. The token is NOT the value — it must be passed to `keynv exec --resolve <token>` to reach the resolved value, which is then injected into a privileged subprocess.',
    inputSchema: {
      type: 'object',
      properties: {
        alias: {
          type: 'string',
          description: 'Alias literal in @project.environment.key form.',
        },
      },
      required: ['alias'],
      additionalProperties: false,
    },
  },
  {
    name: 'keynv.redact_text',
    description:
      'Redacts secret-shaped substrings from arbitrary text using the keynv pattern bank. Useful for scrubbing log output before posting to a chat or commit message.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
] as const;

function jsonContent(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  };
}

function jsonError(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  };
}

export function buildServer(deps: ServerDeps): Server {
  const server = new Server(
    { name: 'keynv-mcp', version: '0.0.0-phase2' },
    { capabilities: { tools: {} } },
  );
  const api = new McpApiClient(deps.creds);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS] }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case 'keynv.who_am_i': {
          const data = await api.request('/v1/whoami');
          return jsonContent(data);
        }

        case 'keynv.list_secrets': {
          const project = String(args.project ?? '');
          if (!project) return jsonError('project is required');
          // Resolve project name → id.
          const projects = await api.request<{
            projects: Array<{ id: string; name: string }>;
          }>('/v1/projects');
          const found = projects.projects.find((p) => p.name === project);
          if (!found) return jsonError(`unknown project: ${project}`);
          const data = await api.request(`/v1/projects/${found.id}/secrets`);
          return jsonContent(data);
        }

        case 'keynv.use_secret': {
          const alias = String(args.alias ?? '');
          const parsed = parseAlias(alias);
          if (!parsed) return jsonError(`invalid alias: ${alias}`);
          // Verify the alias resolves (RBAC / existence) without
          // returning the value to the caller.
          const projects = await api.request<{
            projects: Array<{ id: string; name: string }>;
          }>('/v1/projects');
          const found = projects.projects.find((p) => p.name === parsed.project);
          if (!found) return jsonError(`unknown project: ${parsed.project}`);
          // Probe with a HEAD-equivalent: list and check the alias is present.
          const list = await api.request<{
            secrets: Array<{ alias: string }>;
          }>(`/v1/projects/${found.id}/secrets`);
          if (!list.secrets.some((s) => s.alias === parsed.literal)) {
            return jsonError(`alias not found or no permission: ${parsed.literal}`);
          }
          const issued = issueReferenceToken(parsed.literal);
          return jsonContent({
            reference_token: issued.reference_token,
            alias: parsed.literal,
            expires_at: issued.expires_at,
            usage_hint:
              'Pass reference_token to a privileged subprocess (keynv exec --resolve). Token is single-use and expires in 60s. Raw value never leaves the keynv exec boundary.',
          });
        }

        case 'keynv.redact_text': {
          const text = String(args.text ?? '');
          const result = redact(text);
          return jsonContent({
            redacted: result.text,
            matches_found: result.matches.length,
            pattern_summary: result.matches.reduce<Record<string, number>>((acc, m) => {
              acc[m.pattern] = (acc[m.pattern] ?? 0) + 1;
              return acc;
            }, {}),
          });
        }

        default:
          return jsonError(`unknown tool: ${name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonError(message);
    }
  });

  return server;
}

export async function runStdio(deps: ServerDeps): Promise<void> {
  const server = buildServer(deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
