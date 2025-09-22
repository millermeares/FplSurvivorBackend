// userDal.js

export async function getOrCreateUser(client, userInfo) {
  const userRecord = await getUserBySub(client, userInfo.sub);
  if (userRecord.statusCode === 200) {
    return userRecord;
  }
  return await createUser(client, userInfo);
}

export async function getUserBySub(client, sub) { 
  const query = `SELECT id, sub, email, name, created_at FROM survivor.user WHERE sub = $1;`;
  const res = await client.query(query, [sub]);
  
  if (res.rows.length < 1) {
    return {
      statusCode: 404,
      body: "User does not exist"
    };
  }
  
  return {
    statusCode: 200,
    body: res.rows[0]
  };
}

export async function createUser(client, userInfo) {
  const query = `
        INSERT INTO survivor.user (sub, email, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
            SET sub = survivor.user.sub  -- do not update sub.
        RETURNING id, sub, email, name, created_at;
    `;
    
  const res = await client.query(query, [userInfo.sub, userInfo.email, userInfo.name]);
  
  if (res.rows.length > 0) {
    return {
      statusCode: 201,
      body: res.rows[0]
    };
  }
  
  return {
    statusCode: 500,
    body: "User not created, which is unexpected"
  };
}