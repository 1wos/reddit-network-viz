# infra/cdk — AWS CDK (TypeScript) · learn-by-deploying

Defines the ingestion infrastructure **as code**. Instead of clicking in the AWS
console, you write TypeScript and CDK turns it into CloudFormation and deploys it.

## What it creates

- **S3 bucket** — stores ontology instance snapshots (the frontend reads these)
- **Lambda (container)** — runs the LangGraph pipeline (`services/graph-ingest`)
- **IAM policy** — lets the Lambda call **Bedrock** (Claude) for extraction
- (optional) **EventBridge** hourly schedule

## Prerequisites (one-time)

```bash
# 1) an AWS account + the CLI configured
aws configure                      # Access Key, Secret, region (e.g. us-east-1)

# 2) Node + Docker (CDK builds the Lambda container image locally)
node -v && docker -v

# 3) install deps
cd infra/cdk && npm install
```

## The 4 commands you actually use

```bash
npx cdk bootstrap     # one-time per account/region: sets up CDK's own resources
npx cdk synth         # compile TS → CloudFormation template (no deploy) — safe to inspect
npx cdk diff          # show what WOULD change vs deployed state
npx cdk deploy        # actually create/update the AWS resources
npx cdk destroy       # tear everything down (avoid charges)
```

Start with `synth` — it just prints the template, costs nothing, and proves your
code is valid. Only `deploy` touches your real account.

## Mental model (CDK vs console vs Terraform)

| | How you define infra |
|---|---|
| Console | click buttons (not reproducible) |
| **CDK** | **real code (TS/Python)** → CloudFormation |
| Terraform | declarative HCL (`*.tf`) → provider APIs |

CDK is nice here because the repo is already TS/JS — same language, types, autocomplete.
A Terraform version of the SAME stack is in [`../terraform`](../terraform) for comparison.

## Cost / safety

- `synth`/`diff` are free and local. Only `deploy` provisions resources.
- This stack is tiny (S3 + a Lambda that runs on demand) → ~free at rest.
- Bedrock is billed per token, only when the Lambda runs.
- `npx cdk destroy` removes everything. The bucket is `DESTROY` + `autoDeleteObjects` for easy cleanup (switch to `RETAIN` for prod).

> 처음이면 `npm i` → `npx cdk synth` 까지만 해봐. 템플릿이 출력되면 "코드로 인프라를 정의했다"는 걸 눈으로 확인한 거야. 배포는 준비됐을 때.
