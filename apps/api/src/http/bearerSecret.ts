import crypto from "crypto";

export function isBearerSecretAuthorized(request: Request, expectedSecret: string) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return false;
  }

  const actualBytes = Buffer.from(token, "utf8");
  const expectedBytes = Buffer.from(expectedSecret, "utf8");

  return (
    actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes)
  );
}
