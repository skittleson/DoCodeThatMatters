import type { APIContext } from 'astro';

export async function GET(_context: APIContext) {
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 6);
  const expiresStr = expires.toISOString().replace(/\.\d{3}Z$/, '+00:00');

  const content = `Contact: docodethatmatters@outlook.com
Expires: ${expiresStr}
Preferred-Languages: en
Canonical: https://docodethatmatters.com/security.txt
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
