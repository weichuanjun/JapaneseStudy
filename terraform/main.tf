terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
  
  backend "s3" {
    bucket = "japanese-study-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# Frontend - S3 and CloudFront
module "frontend" {
  source = "./modules/frontend"
  
  project_name    = var.project_name
  environment     = var.environment
  domain_name     = var.domain_name
  s3_bucket_name  = var.frontend_bucket_name
}

# Backend - Lambda and API Gateway
module "backend" {
  source = "./modules/backend"
  
  project_name    = var.project_name
  environment     = var.environment
  lambda_runtime  = "python3.9"
  lambda_handler  = "application.app"
  lambda_memory   = 256
  lambda_timeout  = 30
  
  vpc_id          = module.network.vpc_id
  private_subnets = module.network.private_subnets
  
  depends_on = [module.network, module.database]
}

# Database - Aurora Serverless v2
module "database" {
  source = "./modules/database"
  
  project_name    = var.project_name
  environment     = var.environment
  db_name         = var.db_name
  master_username = var.db_master_username
  
  vpc_id          = module.network.vpc_id
  private_subnets = module.network.private_subnets
}

# Network - VPC and Subnets
module "network" {
  source = "./modules/network"
  
  project_name    = var.project_name
  environment     = var.environment
  vpc_cidr        = var.vpc_cidr
} 