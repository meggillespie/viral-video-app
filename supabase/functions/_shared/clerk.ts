// supabase/functions/_shared/clerk.ts
import { createRemoteJWKSet, jwtVerify } from "npm:jose@^4.14.4";

const CLERK_ISSUER = Deno.env.get('CLERK_ISSUER_URL');

export async function verifyClerkJWT(req: Request) {
  if (!CLERK_ISSUER) {
    throw new Error("CLERK_ISSUER_URL is not set in environment variables.");
  }
  const JWKS = createRemoteJWKSet(new URL(`${CLERK_ISSUER}/.well-known/jwks.json`));
  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.split(' ')[1];
  const { payload } = await jwtVerify(token, JWKS);
  return { userId: payload.sub };
}