declare const __KEYNV_VERSION__: string;

export const VERSION: string =
  typeof __KEYNV_VERSION__ === 'string' ? __KEYNV_VERSION__ : '0.0.0-dev';

export const AGENT = `keynv-mcp/${VERSION}`;
