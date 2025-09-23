// userDal.js

export async function getOrCreateUser(client, userInfo) {
  try {
    const userRecord = await getUserBySub(client, userInfo.sub);
    if (userRecord.statusCode === 200) {
      return userRecord;
    }

    return await createUser(client, userInfo);

  } catch (err) {
    // Handle race conditions
    if (err.code === "40001" || err.code === "23505") {
      // 40001 = serialization failure, 23505 = unique violation
      console.warn("Race condition detected, retrying lookup...");

      // First, try again by sub
      const retrySub = await getUserBySub(client, userInfo.sub);
      if (retrySub.statusCode === 200) {
        return retrySub;
      }

      // If sub wasn’t updated because of your current ON CONFLICT rule,
      // fall back to email lookup
      const retryEmail = await getUserByEmail(client, userInfo.email);
      if (retryEmail.statusCode === 200) {
        return retryEmail;
      }

      // If we’re here, something unexpected happened
      return {
        statusCode: 500,
        body: "User creation conflict but no record found"
      };
    }

    // Rethrow anything else
    throw err;
  }
}

export async function getUserBySub(client, sub) {
  const query = `SELECT id, sub, email, name, created_at FROM survivor.user WHERE sub = $1;`;
  const res = await client.query(query, [sub]);

  if (res.rows.length < 1) {
    return { statusCode: 404, body: "User does not exist" };
  }

  return { statusCode: 200, body: res.rows[0] };
}

export async function getUserByEmail(client, email) {
  const query = `SELECT id, sub, email, name, created_at FROM survivor.user WHERE email = $1;`;
  const res = await client.query(query, [email]);

  if (res.rows.length < 1) {
    return { statusCode: 404, body: "User does not exist" };
  }

  return { statusCode: 200, body: res.rows[0] };
}

export async function createUser(client, userInfo) {
  const query = `
    INSERT INTO survivor.user (sub, email, name)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE
      SET sub = survivor.user.sub  -- keep sub unchanged
    RETURNING id, sub, email, name, created_at;
  `;

  const res = await client.query(query, [userInfo.sub, userInfo.email, userInfo.name]);

  if (res.rows.length > 0) {
    return { statusCode: 201, body: res.rows[0] };
  }

  return { statusCode: 500, body: "User not created, which is unexpected" };
}