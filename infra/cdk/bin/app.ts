#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { IngestStack } from "../lib/ingest-stack";

const app = new cdk.App();
new IngestStack(app, "RedditpulseIngestStack", {
  // Uses the account/region from your `aws configure` / env.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
