const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const notifyRouter = () => {
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const navigateToRoute = (path: string, options?: { replace?: boolean }) => {
  const normalizedPath = normalizePath(path);
  const hasHashRouter = Boolean(window.location.hash && window.location.hash !== '#');
  const targetUrl = hasHashRouter ? `/#${normalizedPath}` : normalizedPath;

  if (options?.replace) {
    window.history.replaceState(window.history.state, '', targetUrl);
  } else {
    window.history.pushState(window.history.state, '', targetUrl);
  }

  notifyRouter();
};
