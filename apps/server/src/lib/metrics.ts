import type { Context, MiddlewareHandler } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    metrics: MetricsRegistry;
  }
}

export type DomainMetricName =
  | 'approval_denial'
  | 'approval_grant'
  | 'audit_append'
  | 'rate_limit_rejection'
  | 'secret_read'
  | 'secret_write';

interface HttpLabels {
  method: string;
  route: string;
  statusClass: string;
}

interface HttpMetric extends HttpLabels {
  count: number;
  errors: number;
  durationSumSeconds: number;
  buckets: number[];
}

export interface MetricsRegistry {
  observeHttpRequest(method: string, path: string, status: number, durationMs: number): void;
  incrementDomainEvent(event: DomainMetricName): void;
  render(): string;
}

const DURATION_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export function createMetricsRegistry(): MetricsRegistry {
  const http = new Map<string, HttpMetric>();
  const domain = new Map<DomainMetricName, number>();

  function getHttpMetric(labels: HttpLabels): HttpMetric {
    const key = `${labels.method}\u0000${labels.route}\u0000${labels.statusClass}`;
    let metric = http.get(key);
    if (!metric) {
      metric = {
        ...labels,
        count: 0,
        errors: 0,
        durationSumSeconds: 0,
        buckets: DURATION_BUCKETS_SECONDS.map(() => 0),
      };
      http.set(key, metric);
    }
    return metric;
  }

  return {
    observeHttpRequest(method, path, status, durationMs) {
      const route = normalizeHttpRoute(path);
      const statusClass = `${Math.floor(status / 100)}xx`;
      const durationSeconds = Math.max(0, durationMs / 1000);
      const metric = getHttpMetric({ method: method.toUpperCase(), route, statusClass });
      metric.count += 1;
      metric.durationSumSeconds += durationSeconds;
      if (status >= 400) metric.errors += 1;
      DURATION_BUCKETS_SECONDS.forEach((bucket, index) => {
        if (durationSeconds <= bucket) metric.buckets[index] = (metric.buckets[index] ?? 0) + 1;
      });
    },
    incrementDomainEvent(event) {
      domain.set(event, (domain.get(event) ?? 0) + 1);
    },
    render() {
      const lines: string[] = [];

      lines.push('# HELP keynv_http_requests_total Total HTTP requests.');
      lines.push('# TYPE keynv_http_requests_total counter');
      for (const metric of sortedHttpMetrics(http)) {
        lines.push(
          `keynv_http_requests_total${formatLabels(metricLabels(metric))} ${metric.count}`,
        );
      }

      lines.push('# HELP keynv_http_errors_total Total HTTP responses with status >= 400.');
      lines.push('# TYPE keynv_http_errors_total counter');
      for (const metric of sortedHttpMetrics(http)) {
        if (metric.errors === 0) continue;
        lines.push(`keynv_http_errors_total${formatLabels(metricLabels(metric))} ${metric.errors}`);
      }

      lines.push('# HELP keynv_http_request_duration_seconds HTTP request duration.');
      lines.push('# TYPE keynv_http_request_duration_seconds histogram');
      for (const metric of sortedHttpMetrics(http)) {
        let cumulative = 0;
        DURATION_BUCKETS_SECONDS.forEach((bucket, index) => {
          cumulative = metric.buckets[index] ?? cumulative;
          lines.push(
            `keynv_http_request_duration_seconds_bucket${formatLabels({
              ...metricLabels(metric),
              le: String(bucket),
            })} ${cumulative}`,
          );
        });
        lines.push(
          `keynv_http_request_duration_seconds_bucket${formatLabels({
            ...metricLabels(metric),
            le: '+Inf',
          })} ${metric.count}`,
        );
        lines.push(
          `keynv_http_request_duration_seconds_sum${formatLabels(metricLabels(metric))} ${metric.durationSumSeconds}`,
        );
        lines.push(
          `keynv_http_request_duration_seconds_count${formatLabels(metricLabels(metric))} ${metric.count}`,
        );
      }

      lines.push('# HELP keynv_domain_events_total Domain events emitted by the API server.');
      lines.push('# TYPE keynv_domain_events_total counter');
      for (const [event, count] of [...domain.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`keynv_domain_events_total${formatLabels({ event })} ${count}`);
      }

      return `${lines.join('\n')}\n`;
    },
  };
}

export function metricsMiddleware(registry: MetricsRegistry): MiddlewareHandler {
  return async (c, next) => {
    c.set('metrics', registry);
    const startedAtMs = Date.now();
    let status = 500;
    try {
      await next();
      status = c.res.status || 200;
    } finally {
      registry.observeHttpRequest(c.req.method, c.req.path, status, Date.now() - startedAtMs);
    }
  };
}

export function recordDomainEvent(c: Context, event: DomainMetricName): void {
  c.get('metrics')?.incrementDomainEvent(event);
}

export function recordAuditDomainEvents(c: Context, eventType: string): void {
  recordDomainEvent(c, 'audit_append');
  if (eventType === 'approval.granted') recordDomainEvent(c, 'approval_grant');
  if (eventType === 'approval.denied') recordDomainEvent(c, 'approval_denial');
  if (eventType.startsWith('secret.read.')) recordDomainEvent(c, 'secret_read');
  if (
    eventType === 'secret.created' ||
    eventType === 'secret.rotated' ||
    eventType === 'secret.deleted'
  ) {
    recordDomainEvent(c, 'secret_write');
  }
}

export function normalizeHttpRoute(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  if (path === '/metrics') return '/metrics';
  if (segments[0] !== 'v1') return sanitizeFallbackPath(segments);

  const area = segments[1];
  if (!area) return '/v1';
  if (area === 'health') return segments[2] ? `/v1/health/${segments[2]}` : '/v1/health';
  if (area === 'auth') return normalizeAuthRoute(segments);
  if (area === 'projects') return normalizeProjectRoute(segments);
  if (area === 'users') return normalizeUsersRoute(segments);
  if (area === 'approvals') return '/v1/approvals';
  if (area === 'audit') return '/v1/audit';
  if (area === 'cli-tokens') return segments[2] ? '/v1/cli-tokens/:id' : '/v1/cli-tokens';
  if (area === 'org') return '/v1/org';
  if (area === 'onboarding') return '/v1/onboarding';
  if (area === 'whoami') return '/v1/whoami';
  if (area === 'search') return '/v1/search';

  return sanitizeFallbackPath(segments);
}

function normalizeAuthRoute(segments: string[]): string {
  if (segments[2] === 'cli' && segments[3] === 'browser' && segments[4]) {
    return `/v1/auth/cli/browser/${segments[4]}`;
  }
  return segments[2] ? `/v1/auth/${segments[2]}` : '/v1/auth';
}

function normalizeProjectRoute(segments: string[]): string {
  if (!segments[2]) return '/v1/projects';
  const suffix = segments.slice(3);
  const first = suffix[0];
  if (!first) return '/v1/projects/:projectId';
  if (first === 'environments') return '/v1/projects/:projectId/environments';
  if (first === 'members')
    return suffix[1]
      ? '/v1/projects/:projectId/members/:userId'
      : '/v1/projects/:projectId/members';
  if (first === 'rotate-dek') return '/v1/projects/:projectId/rotate-dek';
  if (first === 'approvals') {
    if (!suffix[1]) return '/v1/projects/:projectId/approvals';
    return suffix[2]
      ? `/v1/projects/:projectId/approvals/:approvalId/${suffix[2]}`
      : '/v1/projects/:projectId/approvals/:approvalId';
  }
  if (first === 'secrets') return normalizeProjectSecretRoute(suffix);
  return `/v1/projects/:projectId/${sanitizeFallbackPath(suffix).slice(1)}`;
}

function normalizeProjectSecretRoute(suffix: string[]): string {
  if (!suffix[1]) return '/v1/projects/:projectId/secrets';
  if (suffix[1] === 'batch') return '/v1/projects/:projectId/secrets/batch';
  if (suffix[3] === 'rotate') return '/v1/projects/:projectId/secrets/:env/:key/rotate';
  if (suffix[3] === 'test') return '/v1/projects/:projectId/secrets/:env/:key/test';
  return '/v1/projects/:projectId/secrets/:env/:key';
}

function normalizeUsersRoute(segments: string[]): string {
  if (!segments[2]) return '/v1/users';
  if (segments[2] === 'accept-invite') return '/v1/users/accept-invite';
  if (segments[2] === 'invite') return '/v1/users/invite';
  return segments[3] ? `/v1/users/:id/${segments[3]}` : '/v1/users/:id';
}

function sanitizeFallbackPath(segments: string[]): string {
  return `/${segments.map((segment) => (isSensitiveLikeSegment(segment) ? ':id' : segment)).join('/')}`;
}

function isSensitiveLikeSegment(segment: string): boolean {
  return /^(p|u|env|ct|ap|org|m)_[A-Za-z0-9_-]+$/.test(segment) || segment.length > 48;
}

function sortedHttpMetrics(metrics: Map<string, HttpMetric>): HttpMetric[] {
  return [...metrics.values()].sort((a, b) =>
    `${a.method} ${a.route} ${a.statusClass}`.localeCompare(
      `${b.method} ${b.route} ${b.statusClass}`,
    ),
  );
}

function metricLabels(metric: HttpMetric): Record<string, string> {
  return {
    method: metric.method,
    route: metric.route,
    status_class: metric.statusClass,
  };
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels).map(([key, value]) => `${key}="${escapeLabel(value)}"`);
  return `{${entries.join(',')}}`;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}
