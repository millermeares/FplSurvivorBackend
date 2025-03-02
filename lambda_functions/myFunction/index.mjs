import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { NODE_REGION_CONFIG_FILE_OPTIONS, NODE_REGION_CONFIG_OPTIONS } from "@smithy/config-resolver";
import { Hash } from "@smithy/hash-node";
import { loadConfig } from "@smithy/node-config-provider";
import pg from "pg";
const { Client } = pg;

export const getRuntimeConfig = (config) => {
  return {
    runtime: "node",
    sha256: config?.sha256 ?? Hash.bind(null, "sha256"),
    credentials: config?.credentials ?? fromNodeProviderChain(),
    region: config?.region ?? loadConfig(NODE_REGION_CONFIG_OPTIONS, NODE_REGION_CONFIG_FILE_OPTIONS),
    ...config,
  };
};

// Aurora DSQL requires IAM authentication
// This class generates auth tokens signed using AWS Signature Version 4
export class Signer {
  constructor(hostname) {
    const runtimeConfiguration = getRuntimeConfig({});

    this.credentials = runtimeConfiguration.credentials;
    this.hostname = hostname;
    this.region = runtimeConfiguration.region;

    this.sha256 = runtimeConfiguration.sha256;
    this.service = "dsql";
    this.protocol = "https:";
  }
  
  async getAuthToken() {
    const signer = new SignatureV4({
      service: this.service,
      region: this.region,
      credentials: this.credentials,
      sha256: this.sha256,
    });

    // To connect with a custom database role, set Action as "DbConnect"
    const request = new HttpRequest({
      method: "GET",
      protocol: this.protocol,
      hostname: this.hostname,
      query: {
        Action: "DbConnectAdmin",
      },
      headers: {
        host: this.hostname,
      },
    });

    const presigned = await signer.presign(request, {
      expiresIn: 3600,
    });

    // RDS requires the scheme to be removed
    // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.Connecting.html
    return formatUrl(presigned).replace(`${this.protocol}//`, "");
  }
}

// To connect with a custom database role, set user as the database role name
async function dsql_sample(token, endpoint) {
  const client = new Client({
    user: "admin",
    database: "postgres",
    host: endpoint,
    password: token,
    ssl: { 
      rejectUnauthorized: false
    },
  });
  console.log("connecting to aurora dsql")
  await client.connect();
  console.log("[dsql_sample] connected to Aurora DSQL!");

  try {
    console.log("[dsql_sample] attempting transaction.");
    const res = await client.query("BEGIN; SELECT COUNT(*) FROM survivor.user; COMMIT;");
    console.log(res)
    return 200;
  } catch (err) {
    console.log("[dsql_sample] transaction attempt failed!");
    console.error(err);
    return 500;
  } finally {
    console.log("attempting to end connection")
    client.end();
    Promise.resolve()
  }
}


async function getCastaways(args, token, endpoint) {
  return [{
    name: 'Test Castaway',
    id: 'uuid',
    season: 48,
    image_url: 's3 image url...'
  }]
}

function getEventHandlers() {

  return {
    "getcastaways": getCastaways
  }
}

// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
export const handler = async (event) => {
  console.log(event)
  const eventHandlers = getEventHandlers()
  const endpoint = process.env.DB_ENDPOINT;
  const s = new Signer(endpoint);
  const token = await s.getAuthToken();
  console.log("token received")

  const responseCode = await dsql_sample(token, endpoint);
  console.log(responseCode)
  const response = {
    statusCode: responseCode,
    endpoint: endpoint,
  };
  return response;
};