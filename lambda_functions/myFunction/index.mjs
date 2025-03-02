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

const methodBank = {
  '/castaways': getCastaways
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