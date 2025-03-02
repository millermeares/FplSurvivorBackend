import pg from "pg";
const { Client } = pg;
import { Signer } from "./signer.js";

async function getCastaways(client, args) {
  const res = await client.query(`SELECT id, name, season, image_url, _fk_week_eliminated FROM survivor.castaway;`)
  return {
    statusCode: 200,
    body: JSON.stringify(res.rows)
  }
}

async function getUserByEmail(client, args) {
  const email = JSON.parse(args)['email'] // open question - is parse required here?
  const query = `SELECT id, email, created_at FROM survivor.user WHERE email = $1;`;
  const res = await client.query(query, [email]);
  if (res.rows.length < 1) {
    return {
      statusCode: 404,
      body: "User does not exist"
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify(res.rows[0])
  }
}

async function createUser(client, args) {
  const email = JSON.parse(args)['email'] // open question - is parse required here?
  const query = `
        INSERT INTO survivor.user (email)
        VALUES ($1)
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, created_at;
    `;
    
  const res = await client.query(query, [email])
  if (res.rows.length > 0) {
    // successfully created, return!
    return {
      statusCode: 201,
      body: JSON.stringify(res.rows[0])
    }
  }
  return await getUserByEmail(client, args)
}

async function getSelectionsForWeek(client, weekId, userId) {
  const query = `
      SELECT id, _fk_user_id, _fk_week_id, _fk_castaway_id, is_captain, created_at, removed_at
      FROM survivor.selection 
      WHERE _fk_user_id = $1 
      AND _fk_week_id = $2 
      AND removed_at = '9999-12-31 23:59:59';
  `;
  
  const res = await client.query(query, [userId, weekId]);
  return res.rows;
}

async function setSelections(client, args) {
  const body = JSON.parse(args)
  const selections = body['castaways']
  const userId = body['userId']
  const weekId = body['week'] // probably not a great parameterized thing.
  if (selections.length > 3) {
    return {
      statusCode: 400,
      body: "Too many selections"
    }
  }
  // todo: more validation. 
  try {
    await client.query("BEGIN;");
    

    await client.query(
        `UPDATE survivor.selection 
          SET removed_at = NOW()
          WHERE _fk_user_id = $1 
          AND _fk_week_id = $2 
          AND removed_at = '9999-12-31 23:59:59';`,
        [userId, weekId]
    );
    
    
    const query = `
    INSERT INTO survivor.selection (_fk_user_id, _fk_week_id, _fk_castaway_id, is_captain)
    VALUES ${castaways.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(", ")};
    `;

    const values = castaways.flatMap(({ castawayId, isCaptain }) => [userId, weekId, castawayId, isCaptain]);
    await client.query(query, values);

    await client.query("COMMIT;");

  } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
  }
}

const methodBank = {
  '/castaways': getCastaways,
  '/createUser': createUser,
  '/getUser': getUserByEmail,
  '/setSelections': setSelections,
  '/getSelections': getSelectionsForWeek
}

async function execute(event, client) {
  if (!methodBank[event['path']]) {
    console.log(`Could not find registered method for ${event['path']}`)
    return {
      statusCode: 404,
      body: "Path not found"
    }
  }
  const method = methodBank[event['path']]
  try {
    await client.connect()
    return await method(client, event['body'])
  } catch (err) {
    console.log("Error when executing path")
    console.error(err)
    return {
      statusCode: 500,
      body: "Internal Error"
    }
  } finally {
    client.end();
    Promise.resolve()
  }
}

// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
export const handler = async (event) => {
  console.log(event)
  const endpoint = process.env.DB_ENDPOINT;
  const s = new Signer(endpoint);
  const token = await s.getAuthToken();
  console.log("auth token received, creating client and continuing.")
  const client = new Client({
    user: "admin",
    database: "postgres",
    host: endpoint,
    password: token,
    ssl: { 
      rejectUnauthorized: false
    },
  });

  return await execute(event, client)
};