// Purpose: the server's one route table — every HTTP route the product serves, each named by the
// subject INVENTORY.md uses for it. checks/extractors/routes.sh reads the `subject:` literals of this
// file, so a route added anywhere but here is a route the courts cannot see (D-019).

export interface RouteEntry {
  method: 'GET' | 'POST';
  path: string;
  /** The literal INVENTORY.md uses for this surface. */
  subject: string;
}

export const ROUTES: readonly RouteEntry[] = [
  // The checker page (REQ-001, REQ-019) and its content-hashed script and style.
  { method: 'GET', path: '/', subject: '/' },
  { method: 'GET', path: '/assets/:name', subject: '/' },
  // The privacy note (REQ-033).
  { method: 'GET', path: '/privacidad', subject: 'privacy' },
  // The check endpoint (REQ-001, REQ-017, REQ-021, REQ-022).
  { method: 'POST', path: '/api/check', subject: 'server' },
  // Readiness: answers once the dictionary is loaded (REQ-025).
  { method: 'GET', path: '/healthz', subject: 'server' },
];
