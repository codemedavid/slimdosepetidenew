// Vercel Function: issues short-lived ImageKit upload signatures so the browser
// can upload straight to ImageKit without ever seeing the private key.
// Requires IMAGEKIT_PRIVATE_KEY in the Vercel project env (never VITE_-prefixed).
import { createHmac, randomUUID } from 'node:crypto';

// ImageKit rejects signatures that expire more than an hour ahead.
const TOKEN_TTL_SECONDS = 10 * 60;

export function GET(): Response {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    return Response.json({ error: 'ImageKit is not configured on the server.' }, { status: 500 });
  }

  const token = randomUUID();
  const expire = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const signature = createHmac('sha1', privateKey).update(token + expire).digest('hex');

  return Response.json(
    { token, expire, signature },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
