"""
AWS Lambda entrypoint for the LangGraph ingestion pipeline.

Trigger: EventBridge schedule / S3 put / direct invoke with {"text","source"}.
Flow: text → LangGraph (extract→validate→link→emit) → write instances to S3.
The JS frontend reads the S3 snapshot (or a graph DB loads it).
"""
import json
import os

from pipeline import run_ingest


def handler(event, _context=None):
    text = event.get("text") or event.get("body", "")
    source = event.get("source", "lambda")
    result = run_ingest(text, source=source)

    bucket = os.environ.get("INSTANCES_BUCKET")
    if bucket:
        import boto3
        key = f"instances/{source.replace(':', '_')}.json"
        boto3.client("s3").put_object(Bucket=bucket, Key=key, Body=json.dumps(result["instances"]).encode())
        result["s3"] = f"s3://{bucket}/{key}"

    return {"statusCode": 200, "body": json.dumps(result)}
