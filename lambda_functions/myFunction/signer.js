import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { NODE_REGION_CONFIG_FILE_OPTIONS, NODE_REGION_CONFIG_OPTIONS } from "@smithy/config-resolver";
import { Hash } from "@smithy/hash-node";
import { loadConfig } from "@smithy/node-config-provider";

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
