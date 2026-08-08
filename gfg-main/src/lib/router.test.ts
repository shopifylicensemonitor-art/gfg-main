import { beforeEach, describe, expect, it } from 'vitest';
import { navigateToRoute } from './router';

describe('navigateToRoute', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('uses hash-based navigation when the app is running under hash routing', () => {
    window.history.replaceState({}, '', '/#/dashboard');

    navigateToRoute('/login');

    expect(window.location.hash).toBe('#/login');
    expect(window.location.pathname).toBe('/');
  });

  it('uses browser-style history updates for standard SPA routing', () => {
    window.history.replaceState({}, '', '/dashboard');

    navigateToRoute('/login');

    expect(window.location.pathname).toBe('/login');
  });
});
