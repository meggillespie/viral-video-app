// File: supabase/functions/_shared/clerk.ts

import { createRemoteJWKSet, jwtVerify } from "npm:jose@^4.14.4";

// This function verifies the JWT from the request headers.
export async function verifyClerkJWT(req: Request) {
  const issuer = Deno.env.get('CLERK_ISSUER_URL');
  if (!issuer) {
    throw new Error("CLERK_ISSUER_URL environment variable not set.");
  }

  try {
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header.");
    }

    const token = authHeader.split(' ')[1];
    const { payload } = await jwtVerify(token, jwks);

    // Look for the custom 'subject' claim instead of the standard 'sub' claim.
    if (!payload.subject) {
        throw new Error("Token does not have a 'subject' claim.");
    }
    
    // Return the user ID from the 'subject' claim.
    return { userId: payload.subject as string };

  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    // Re-throw the error to be caught by the main handler
    throw error;
  }
}