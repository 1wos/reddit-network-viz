## Terraform equivalent of the CDK IngestStack — same infra, declarative HCL.
## Provisions: S3 snapshot bucket + container Lambda (LangGraph) + Bedrock IAM.
##
##   cd infra/terraform
##   terraform init
##   terraform plan      # preview (free, no changes)
##   terraform apply     # create resources
##   terraform destroy   # tear down

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "us-east-1"
}

# Container image for the Lambda is pushed to ECR (build/push outside Terraform,
# or use the aws_ecr + docker provider). Reference it by URI here.
variable "image_uri" {
  type        = string
  description = "ECR image URI for services/graph-ingest (built from its Dockerfile)"
}

# 1) Snapshot bucket
resource "aws_s3_bucket" "instances" {
  bucket_prefix = "redditpulse-instances-"
  force_destroy = true
}

# 2) Lambda execution role + policy (S3 write + Bedrock invoke + logs)
resource "aws_iam_role" "ingest" {
  name = "redditpulse-ingest-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy" "ingest" {
  role = aws_iam_role.ingest.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect = "Allow", Action = ["s3:PutObject"], Resource = "${aws_s3_bucket.instances.arn}/*" },
      { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = "*" },
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "*" }
    ]
  })
}

# 3) Container Lambda running the LangGraph pipeline
resource "aws_lambda_function" "ingest" {
  function_name = "redditpulse-graph-ingest"
  role          = aws_iam_role.ingest.arn
  package_type  = "Image"
  image_uri     = var.image_uri
  timeout       = 120
  memory_size   = 1024
  environment {
    variables = {
      INSTANCES_BUCKET = aws_s3_bucket.instances.bucket
      BEDROCK_MODEL    = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    }
  }
}

output "bucket_name"   { value = aws_s3_bucket.instances.bucket }
output "function_name" { value = aws_lambda_function.ingest.function_name }
