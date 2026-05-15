import { reference } from '@keynv/core';
import { redact } from '@keynv/redactor';
import { runTest, testers } from '@keynv/testers';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpApiClient } from './api-client.js';
import type { Credentials } from './credentials.js';
import { issueReferenceToken } from './tokens.js';

interface ServerDeps {
  creds: Credentials;
}

const TOOLS = [
  {
    name: 'keynv.who_am_i',
    description: 'Returns the user identity and project memberships available to this MCP session.',
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
  {
    name: 'keynv.test_connection',
    description:
      'Verifies a credential actually works against a target service. Returns OK/FAIL + latency; the secret value is resolved internally and never returned. Errors are sanitized so wrong-credential responses cannot leak the value.',
    inputSchema: {
      type: 'object',
      properties: {
        alias: { type: 'string', description: '@project.environment.key reference.' },
        tester: {
          type: 'string',
          enum: ['postgres', 'mysql', 'redis', 'ssh', 'http'],
          description: 'Which tester to run.',
        },
        target: {
          type: 'object',
          description:
            'Tester-specific configuration. See docs/06-api-spec.md or `keynv test --help` for the per-tester schema.',
          additionalProperties: true,
        },
      },
      required: ['alias', 'tester', 'target'],
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

  async function resolveProjectId(projectName: string): Promise<string | null> {
    const projects = await api.request<{
      projects: Array<{ id: string; name: string }>;
    }>('/v1/projects');
    const found = projects.projects.find((p) => p.name === projectName);
    return found?.id ?? null;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS] }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;

    // Carry the resolved value (if any) into the outer catch so even
    // exceptions thrown OUTSIDE runTest get scrubbed before the message
    // hits the agent (audit finding H1).
    let resolvedValue: string | null = null;

    try {
      switch (name) {
        case 'keynv.who_am_i': {
          const data = await api.request('/v1/whoami');
          return jsonContent(data);
        }

        case 'keynv.list_secrets': {
          const project = String(args.project ?? '');
          if (!project) return jsonError('project is required');
          const projectId = await resolveProjectId(project);
          if (!projectId) return jsonError(`unknown project: ${project}`);
          const data = await api.request(`/v1/projects/${projectId}/secrets`);
          return jsonContent(data);
        }

        case 'keynv.use_secret': {
          const alias = String(args.alias ?? '');
          const parsed = reference.parseAlias(alias);
          if (!parsed) return jsonError(`invalid alias: ${alias}`);
          // Verify the alias resolves (RBAC / existence) without
          // returning the value to the caller.
          const projectId = await resolveProjectId(parsed.project);
          if (!projectId) return jsonError(`unknown project: ${parsed.project}`);
          // Probe with a HEAD-equivalent: list and check the alias is present.
          const list = await api.request<{
            secrets: Array<{ alias: string }>;
          }>(`/v1/projects/${projectId}/secrets`);
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

        case 'keynv.test_connection': {
          const alias = String(args.alias ?? '');
          const parsed = reference.parseAlias(alias);
          if (!parsed) return jsonError(`invalid alias: ${alias}`);
          const testerType = String(args.tester ?? '');
          const tester = testers.find((t) => t.type === testerType);
          if (!tester) {
            return jsonError(
              `unknown tester '${testerType}'. Try one of: ${testers.map((t) => t.type).join(', ')}`,
            );
          }
          const target = (args.target ?? {}) as Record<string, unknown>;

          const projectId = await resolveProjectId(parsed.project);
          if (!projectId) return jsonError(`unknown project: ${parsed.project}`);
          const data = await api.request<{ value: string }>(
            `/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}`,
          );
          resolvedValue = data.value;

          const result = await runTest({
            tester,
            secret: { alias: parsed.literal, value: data.value },
            target,
          });
          // The result already passes through the redactor / sanitizer
          // inside runTest; we pass it back verbatim.
          return jsonContent({
            alias: parsed.literal,
            tester: testerType,
            ok: result.ok,
            latency_ms: result.latency_ms,
            ...(result.error ? { error: result.error } : {}),
            ...(result.info ? { info: result.info } : {}),
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
      let message = err instanceof Error ? err.message : String(err);
      // Defense-in-depth: if a value was resolved before the throw,
      // strip it literally; then run the redactor pattern bank over
      // whatever's left. Driver-level exceptions sometimes carry
      // connection-string fragments in their messages.
      if (resolvedValue && resolvedValue.length > 0) {
        message = message.split(resolvedValue).join('<redacted>');
      }
      message = redact(message).text;
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
