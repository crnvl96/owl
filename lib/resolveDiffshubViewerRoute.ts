import { normalizeGitHubPath } from './normalizeGitHubPath';

const GITHUB_HOST = 'github.com';
// Reserved catch-all segment that selects the local-worktree viewer mode.
// Chosen as a single non-domain-shaped token so it can't be misread as a
// GitHub owner/repo pair by the bare-path regex below.
const LOCAL_WORKTREE_PATH_SEGMENT = '__local_worktree__';

export type DiffshubViewerRoute =
  | { kind: 'redirect'; target: string }
  | {
      kind: 'render';
      upstreamPath: string;
      url: string;
      domain: string | undefined;
    }
  | {
      kind: 'local-worktree';
    };

// Resolves the catch-all viewer route into either a redirect or the props the
// viewer needs to render. Extracted from the route page so it can be unit
// tested without spinning up Next.js. Empty paths redirect to the home page;
// the reserved local-worktree segment selects the local git diff viewer;
// GitHub paths are canonicalized via normalizeGitHubPath so direct navigation
// matches the hrefs getPatchViewerHref produces from form input. Non-GitHub
// hosts are passed through unchanged because their canonical form is unknown.
export function resolveDiffshubViewerRoute(
  pathSegments: readonly string[],
  requestedDomainInput: string | undefined
): DiffshubViewerRoute {
  if (pathSegments.length === 0) {
    return { kind: 'redirect', target: '/' };
  }

  if (
    pathSegments.length === 1 &&
    pathSegments[0] === LOCAL_WORKTREE_PATH_SEGMENT
  ) {
    return { kind: 'local-worktree' };
  }

  const domain =
    requestedDomainInput == null || requestedDomainInput === ''
      ? undefined
      : requestedDomainInput;
  const joinedPath = `/${pathSegments.join('/')}`;
  const upstreamPath =
    domain == null ? normalizeGitHubPath(joinedPath) : joinedPath;

  if (upstreamPath !== joinedPath) {
    const query = domain == null ? '' : `?domain=${encodeURIComponent(domain)}`;
    return { kind: 'redirect', target: `${upstreamPath}${query}` };
  }

  const host = domain ?? GITHUB_HOST;
  return {
    domain,
    kind: 'render',
    upstreamPath,
    url: `https://${host}${upstreamPath}`,
  };
}
