import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET
const AUTH0_INTROSPECTION_URL = `https://${AUTH0_DOMAIN}/oauth/token/introspect`;
const AUTH0_AUDIENCE = process.env.AUTH0_API_ID

const AUTH0_USERINFO_DOMAIN = 'https://dev-2vs2quxv5ne8187x.us.auth0.com/userinfo'
/**
 * Retrieves user info for an opaque Auth0 token.
 * @param {string} token - The opaque access token.
 * @returns {Promise<Object>} - The user info if valid, otherwise an error object.
 */
export async function getUserInfo(token) {
  if (!token) {
    throw new Error("Token is required");
  }

  try {
    const response = await fetch(AUTH0_USERINFO_DOMAIN, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
    });

    if (!response.ok) {
      console.log(response)
      throw new Error("Invalid token or Auth0 error");
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch user info: ${error.message}`);
  }
}

const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
      if (err) {
          return callback(err, null);
      }
      const signingKey = key.publicKey || key.rsaPublicKey;
      callback(null, signingKey);
  });
}

export async function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
        audience: AUTH0_AUDIENCE,
        issuer: `https://${AUTH0_DOMAIN}/`,
        algorithms: ['RS256']
    }, (err, decoded) => {
        if (err) {
            return reject(err);
        }
        resolve(decoded);
    });
  }); 
}

