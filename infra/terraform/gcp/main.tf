## GCP — the same ingest stack, GCP primitives.
## Object storage (GCS) + container serverless (Cloud Run) + IAM (Vertex AI invoke).
##   terraform init && terraform validate                       # offline, no credentials
##   terraform plan -var="project=<id>" -var="image_uri=<AR uri>"  # preview (needs GCP creds)

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}

provider "google" {
  project = var.project
  region  = var.region
}

variable "project" {
  type    = string
  default = "redditpulse-demo"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "image_uri" {
  type        = string
  description = "Artifact Registry image for services/graph-ingest"
  default     = "us-central1-docker.pkg.dev/redditpulse-demo/repo/graph-ingest:latest"
}

# 1) Snapshot bucket
resource "google_storage_bucket" "instances" {
  name                        = "${var.project}-redditpulse-instances"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true
}

# 2) Service account for the ingest workload (IAM role analog)
resource "google_service_account" "ingest" {
  account_id   = "redditpulse-ingest"
  display_name = "RedditPulse graph-ingest"
}

# 3) IAM: bucket write + Vertex AI invoke (the Bedrock analog)
resource "google_storage_bucket_iam_member" "ingest_write" {
  bucket = google_storage_bucket.instances.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.ingest.email}"
}

resource "google_project_iam_member" "ingest_vertex" {
  project = var.project
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.ingest.email}"
}

# 4) Cloud Run service running the LangGraph container pipeline
resource "google_cloud_run_v2_service" "ingest" {
  name     = "redditpulse-graph-ingest"
  location = var.region

  template {
    service_account = google_service_account.ingest.email
    timeout         = "120s"

    containers {
      image = var.image_uri
      env {
        name  = "INSTANCES_BUCKET"
        value = google_storage_bucket.instances.name
      }
    }
  }
}

output "bucket_name" { value = google_storage_bucket.instances.name }
output "service_url" { value = google_cloud_run_v2_service.ingest.uri }
