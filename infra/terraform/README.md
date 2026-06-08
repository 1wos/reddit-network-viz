# infra/terraform — multi-cloud IaC

The ingestion stack (object storage + container serverless + an identity with
model-invoke permission) declared as HCL for **all three major clouds**. One tool,
provider-agnostic skill — each module provisions the cloud's native primitives,
not a forced one-size-fits-all.

| Cloud | Storage | Serverless container | Identity / model access |
| --- | --- | --- | --- |
| **AWS** (`aws/`) | S3 bucket | Lambda (container image) | IAM role → `bedrock:InvokeModel` |
| **GCP** (`gcp/`) | GCS bucket | Cloud Run v2 | Service account → `aiplatform.user` |
| **Azure** (`azure/`) | Blob storage | Container Apps | Managed identity → Blob Data Contributor |

All three are validated offline (no cloud credentials — `init` only downloads the
provider, `validate` checks the config against its schema):

```bash
for c in aws gcp azure; do (cd $c && terraform init && terraform validate); done
# → Success! The configuration is valid.  (×3)
```

`terraform plan` was additionally run against live accounts to confirm the configs
are accepted by the real provider APIs (no resources created):

| Cloud | Check | Result |
| --- | --- | --- |
| AWS | `validate` | valid |
| GCP | `validate` + `plan` (live project) | **Plan: 5 to add** |
| Azure | `validate` + `plan` (live subscription) | **Plan: 7 to add** |

`terraform plan` / `apply` need that cloud's credentials and an image URI; the
actual deploy proof for this project is the **kind + Helm** Kubernetes deploy
(see [`platform/RUNBOOK.md`](../../platform/RUNBOOK.md)) — Terraform here
demonstrates cloud-agnostic IaC, not a third deployment target.
