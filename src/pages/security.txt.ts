import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 6);
  const expiresStr = expires.toISOString().replace(/\.\d{3}Z$/, '+00:00');

  const canonicalUrl = context.site
    ? new URL('security.txt', context.site).href
    : '/security.txt';

  const content = `Contact: docodethatmatters@outlook.com
Expires: ${expiresStr}
Preferred-Languages: en
Canonical: ${canonicalUrl}
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
