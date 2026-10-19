terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.69"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  # Created by infra/bootstrap. Native S3 lockfile, no DynamoDB lock table.
  backend "s3" {
    bucket       = "pantry-tfstate-816940506502"
    key          = "pantry/terraform.tfstate"
    region       = "us-east-1"
    profile      = "pantry"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "pantry"
  default_tags {
    tags = { app = "pantry" }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name       = "pantry"
  account_id = data.aws_caller_identity.current.account_id
  # Secrets live here as SecureStrings, put there by scripts/set_aws_secrets.py (never Terraform).
  ssm_prefix = "/pantry/"
}
