variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "s3_bucket_name" {
  description = "S3 bucket name for frontend static files"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for CloudFront distribution"
  type        = string
} 