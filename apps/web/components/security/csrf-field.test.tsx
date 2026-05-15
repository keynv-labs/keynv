import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CsrfField, CsrfProvider } from './csrf-field';

describe('CsrfField', () => {
  it('renders the hidden csrf input when a provider token exists', () => {
    const html = renderToStaticMarkup(
      createElement(
        CsrfProvider,
        { token: 'csrf-test-token' },
        createElement('form', null, createElement(CsrfField)),
      ),
    );

    expect(html).toContain('type="hidden"');
    expect(html).toContain('name="csrf_token"');
    expect(html).toContain('value="csrf-test-token"');
  });

  it('renders nothing without a provider token', () => {
    expect(renderToStaticMarkup(createElement(CsrfField))).toBe('');
  });
});
