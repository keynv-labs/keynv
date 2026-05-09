import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'keynv-server';
const AUDIENCE = 'keynv';

export interface AccessTokenClaims {
  sub: string; // user_id
  email: string;
  org_id: string;
  org_role: string;
}

/**
 * Builds the symmetric secret used to sign / verify JWTs from the
 * configured raw secret string.
 */
function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  opts: { secret: string; ttlSeconds: number },
): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${opts.ttlSeconds}s`)
    .sign(key(opts.secret));
}

export async function verifyAccessToken(
  token: string,
  opts: { secret: string },
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, key(opts.secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return {
    sub: payload.sub as string,
    email: payload['email'] as string,
    org_id: payload['org_id'] as string,
    org_role: payload['org_role'] as string,
  };
}
