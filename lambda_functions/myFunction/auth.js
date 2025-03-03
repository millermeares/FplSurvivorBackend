import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const auth0Domain = process.env.AUTH0_DOMAIN; // Example: "your-tenant.us.auth0.com"
const auth0Id = process.env.AUTH0_API_ID;
const clientJWKS = jwksClient({
  jwksUri: `https://${auth0Domain}/.well-known/jwks.json`
});

const getKey = async (header) => {
  const key = await clientJWKS.getSigningKey(header.kid);
  return key.getPublicKey();
};

export default async function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      { audience: auth0Id, issuer: `https://${auth0Domain}/` },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      }
    );
  });
};