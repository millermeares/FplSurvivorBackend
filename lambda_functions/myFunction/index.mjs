import pg from "pg";
const { Client } = pg;
import { Signer } from "./signer.js";
import { getUserInfo, verifyToken } from "./auth.js";
import { getOrCreateUser } from "./userDal.js" 

async function getCastaways(client, args, userRecord) {
  const res = await client.query(`SELECT id, name, season, image_url, _fk_week_eliminated FROM survivor.castaway;`)
  return {
    statusCode: 200,
    body: res.rows
  }
}

async function getSelectionsForWeek(client, args, userRecord) {
  const weekId = JSON.parse(args).weekId
  const userId = userRecord.id
  const query = `
      SELECT id, _fk_user_id, _fk_week_id, _fk_castaway_id, is_captain, created_at, removed_at
      FROM survivor.selection 
      WHERE _fk_user_id = $1 
      AND _fk_week_id = $2 
      AND removed_at = '9999-12-31 23:59:59';
  `;
  try {
    const res = await client.query(query, [userId, weekId]);
    return {
      statusCode: 200,
      body: res.rows
    }
  } catch (err) {
    console.log(err)
    console.log("error getting selections for week")
    return {
      status: 500,
      body: "Something went wrong"
    }
  }
}

async function setSelections(client, args, userRecord) {
  const body = JSON.parse(args) // todo - not sure if this needed.
  const selections = body['castaways'] // [{ castawayId, isCaptain }]
  const userId = userRecord.id
  const weekId = body['week'] // probably not a great parameterized thing.
  if (selections.length > 1) {
    return {
      statusCode: 400,
      body: "Too many selections"
    }
  }
  // todo: more validation, especially around what week we are setting selections for.
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
  '/setSelections': setSelections,
  '/getSelectionsForWeek': getSelectionsForWeek
}

function stringifyIfNotString(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function execute(event, client, userRecord) {
  if (!methodBank[event['path']]) {
    console.log(`Could not find registered method for ${event['path']}`)
    return {
      statusCode: 404,
      body: "Path not found"
    }
  }
  const method = methodBank[event['path']]
  try {
    return await method(client, event['body'], userRecord)
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

function handleCors(result) {
  result['headers'] = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  } 
  result.body = stringifyIfNotString(result.body)
  return result
}

async function getConnectedDbClient() { 
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
  await client.connect()
  return client
}

async function getVerifiedUserInfo(token) {
  try {
    return await verifyToken(token)
  } catch (err) {
    console.error(err)
    return {
      statusCode: 401,
      message: "Failed to retrieve valid user information"
    }
  }
}

// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
export const handler = async (event) => {
  try {
    console.log(event)
    if (event.httpMethod == "OPTIONS") {
      return {
          statusCode: 204,
          headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization"
          },
        body: ""
      };
    }


    // Extract Authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized: No valid token provided" }) };
    }
    const accessToken = authHeader.split(" ")[1];
    const userInfo = await getUserInfo(accessToken)
    console.log(userInfo)
    if (userInfo.statusCode == 401) {
      return userInfo
    }
    const client = await getConnectedDbClient()
    const userResult = await getOrCreateUser(client, userInfo)
    console.log(userResult)
    if (userResult.statusCode > 201) {
      return userResult
    }
    const userRecord = userResult.body
    console.log(userRecord)
    const result = await execute(event, client)
    return handleCors(result)
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      body: "Something went wrong"
    }
  }
};