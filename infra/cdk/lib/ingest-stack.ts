/**
 * IngestStack — Infrastructure-as-Code (AWS CDK v2, TypeScript)
 *
 * Provisions the data plane for the RedditPulse ontology ingestion:
 *   - S3 bucket for instance snapshots (the frontend reads these)
 *   - Container Lambda running the LangGraph pipeline (services/graph-ingest)
 *   - IAM permission to call Bedrock (Claude) for extraction
 *   - (optional) hourly EventBridge schedule
 *
 * Deploy:  cd infra/cdk && npm i && npx cdk bootstrap && npx cdk deploy
 */
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "path";

export class IngestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1) Bucket for ontology instance snapshots (frontend reads these directly).
    const bucket = new s3.Bucket(this, "InstancesBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // demo-friendly; use RETAIN in prod
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // 2) The LangGraph ingestion pipeline as a container Lambda (deps baked via Dockerfile).
    const ingestFn = new lambda.DockerImageFunction(this, "GraphIngestFn", {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, "../../../services/graph-ingest")),
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
      environment: {
        INSTANCES_BUCKET: bucket.bucketName,
        BEDROCK_MODEL: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      },
    });

    // 3) Permissions: write snapshots + invoke Bedrock models.
    bucket.grantWrite(ingestFn);
    ingestFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["*"], // tighten to a specific model ARN in prod
    }));

    // 4) (Optional) run ingestion hourly — uncomment to enable.
    // new events.Rule(this, "HourlyIngest", {
    //   schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    //   targets: [new targets.LambdaFunction(ingestFn)],
    // });

    new cdk.CfnOutput(this, "BucketName", { value: bucket.bucketName });
    new cdk.CfnOutput(this, "FunctionName", { value: ingestFn.functionName });
  }
}
