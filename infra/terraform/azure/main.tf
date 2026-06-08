## Azure — the same ingest stack, Azure primitives.
## Object storage (Blob) + container serverless (Container Apps) + Managed Identity.
##   terraform init && terraform validate                 # offline, no credentials
##   terraform plan -var="image=<registry/repo:tag>"      # preview (needs Azure creds)

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.100" }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  type    = string
  default = "koreacentral"
}

variable "image" {
  type        = string
  description = "Container image (registry/repo:tag) for services/graph-ingest"
  default     = "ghcr.io/1wos/graph-ingest:latest"
}

resource "azurerm_resource_group" "rg" {
  name     = "redditpulse-rg"
  location = var.location
}

# 1) Snapshot storage (account + private container)
resource "azurerm_storage_account" "instances" {
  name                     = "rpinstances0608"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "instances" {
  name                  = "instances"
  storage_account_name  = azurerm_storage_account.instances.name
  container_access_type = "private"
}

# 2) Managed identity (IAM role analog) + RBAC to write blobs
resource "azurerm_user_assigned_identity" "ingest" {
  name                = "redditpulse-ingest"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
}

resource "azurerm_role_assignment" "ingest_blob" {
  scope                = azurerm_storage_account.instances.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.ingest.principal_id
}

# 3) Serverless container (Container Apps) running the LangGraph pipeline
resource "azurerm_container_app_environment" "env" {
  name                = "redditpulse-env"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
}

resource "azurerm_container_app" "ingest" {
  name                         = "redditpulse-graph-ingest"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.ingest.id]
  }

  template {
    container {
      name   = "ingest"
      image  = var.image
      cpu    = 0.5
      memory = "1Gi"
      env {
        name  = "INSTANCES_BUCKET"
        value = azurerm_storage_container.instances.name
      }
    }
  }
}

output "storage_account" { value = azurerm_storage_account.instances.name }
output "resource_group"  { value = azurerm_resource_group.rg.name }
