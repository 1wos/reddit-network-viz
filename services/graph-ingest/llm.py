"""
LLM client — Bedrock-first, Anthropic fallback. Returns parsed JSON for the
extraction step. Pluggable: both providers honor the same prompt contract.
"""
import json
import os
import re


def _parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        return json.loads(m.group(0)) if m else {"objects": [], "links": []}


def extract_json(system: str, user: str) -> dict:
    """Call the configured LLM and return {objects, links}."""
    # Prefer AWS Bedrock (ties into the AWS pipeline); fall back to Anthropic.
    if os.environ.get("AWS_REGION"):
        import boto3  # noqa
        client = boto3.client("bedrock-runtime")
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31", "max_tokens": 1500,
            "system": system, "messages": [{"role": "user", "content": user}],
        })
        resp = client.invoke_model(modelId=os.environ.get("BEDROCK_MODEL", "anthropic.claude-3-5-sonnet-20241022-v2:0"), body=body)
        text = "".join(b["text"] for b in json.loads(resp["body"].read())["content"] if b["type"] == "text")
        return _parse_json(text)

    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic  # noqa
        client = anthropic.Anthropic()
        msg = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"), max_tokens=1500,
            system=system, messages=[{"role": "user", "content": user}],
        )
        return _parse_json("".join(b.text for b in msg.content if b.type == "text"))

    raise RuntimeError("No LLM configured: set AWS_REGION (Bedrock) or ANTHROPIC_API_KEY.")
