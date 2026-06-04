# infra/terraform — same stack, the Terraform way (for comparison)

The CDK stack and this Terraform config provision the *same* AWS resources
(S3 + container Lambda + Bedrock IAM). Compare them to learn the two IaC styles:

| | CDK | Terraform |
|---|---|---|
| Language | TypeScript (imperative) | HCL (declarative) |
| Under the hood | CloudFormation | provider APIs |
| Image build | CDK builds it for you | build + push to ECR yourself |
| Commands | `cdk synth / deploy / destroy` | `terraform plan / apply / destroy` |

## Run

```bash
cd infra/terraform
terraform init
terraform plan  -var="image_uri=<ECR image uri>"   # preview, free
terraform apply -var="image_uri=<ECR image uri>"   # create
terraform destroy                                  # tear down
```

Build/push the image first (Terraform references it by `image_uri`):

```bash
aws ecr create-repository --repository-name graph-ingest
docker build -t graph-ingest services/graph-ingest
# docker tag + push to the ECR repo, then pass that URI as image_uri
```

> CDK는 이미지 빌드까지 알아서 해주고, Terraform은 네가 직접 빌드/푸시해서 URI를 넘겨줘 — 이 차이가 두 도구의 성격(통합형 vs 범용형)을 잘 보여줘.
