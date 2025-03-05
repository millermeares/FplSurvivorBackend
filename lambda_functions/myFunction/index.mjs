import pg from "pg";
const { Client } = pg;
import { Signer } from "./signer.js";
import { getUserInfo, verifyToken } from "./auth.js";
import { getOrCreateUser } from "./userDal.js" 
import { getSelectionsForWeek, getCastawaysWithSelections, setSelections } from './selectionsDal.js'
import { getWeek } from './weekDal.js'


async function getCastaways(client, args, userRecord) {
  const res = await client.query(`SELECT id, name, season, image_url, _fk_week_eliminated FROM survivor.castaway;`)
  return {
    statusCode: 200,
    body: res.rows
  }
}

/**
 * Determines if the current time is past the lock time for the given week.
 * @param {{ season: number, episode_number: number, lock_time: string }} week - The week object with lock_time in UTC.
 * @returns {boolean} True if the current time is past the lock time, otherwise false.
 */
function isPastLockTime(week) {
  if (!week || !week.lock_time) {
      throw new Error("Invalid week object: missing lock_time");
  }

  const lockTime = new Date(week.lock_time); // Convert lock_time string to Date object
  const now = new Date(); // Get current time in UTC
  return now > lockTime;
}



async function setSelectionsIfValid(client, args, userRecord) {
  const body = JSON.parse(args)
  const castaways = body.castaways
  const weekId = body.week
  const week = await getWeek(client, weekId)
  console.log(week)
  if (isPastLockTime(week)) {
    return {
      statusCode: 400,
      body: "Submission time for this week is over."
    }
  }
  return setSelections(client, weekId, castaways, userRecord)
}


const methodBank = {
  '/castaways': getCastaways,
  '/setSelections': setSelectionsIfValid,
  '/getSelectionsForWeek': getSelectionsForWeek,
  '/castawaysWithSelections': getCastawaysWithSelections
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
    const result = await execute(event, client, userRecord)
    return handleCors(result)
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      body: "Something went wrong"
    }
  }
};