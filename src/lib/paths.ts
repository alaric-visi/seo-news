/** Site-relative links under the app's base path (/tools/seo-news/), with trailing slashes. */
const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export function href(path = '', hash?: string): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const isFile = /\.[a-z0-9]+$/i.test(clean);
  const url = clean ? `${BASE}${clean}${isFile ? '' : '/'}` : BASE;
  return hash ? `${url}#${hash}` : url;
}

export const dayHref = (day: string) => href(day);
export const tagHref = (tag: string) => href(`tag/${tag}`);
export const archiveHref = (month?: string) => href('archive', month ? `m-${month}` : undefined);
export const rssHref = () => href('rss.xml');
