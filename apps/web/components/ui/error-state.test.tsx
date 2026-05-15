import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('renders title, description, digest, and actions', () => {
    const html = renderToStaticMarkup(
      createElement(ErrorState, {
        title: 'Something went wrong',
        description: 'A safe public error message.',
        digest: 'abc123',
        actions: createElement('button', { type: 'button' }, 'Retry'),
      }),
    );

    expect(html).toContain('Something went wrong');
    expect(html).toContain('A safe public error message.');
    expect(html).toContain('abc123');
    expect(html).toContain('Retry');
  });
});
