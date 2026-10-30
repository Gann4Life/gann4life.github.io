/** Prefixes a site-relative path ("/work/x/", "work/x/" or "/") with the deploy base (import.meta.env.BASE_URL), joined by exactly one "/"; the trailing slash of path is kept. The only reader of BASE_URL in src. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}
