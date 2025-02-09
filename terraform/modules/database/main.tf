# Aurora Serverless v2 cluster
resource "aws_rds_cluster" "main" {
  cluster_identifier     = "${var.project_name}-${var.environment}"
  engine                = "aurora-postgresql"
  engine_mode           = "provisioned"
  engine_version        = "14.6"
  database_name         = var.db_name
  master_username       = var.master_username
  master_password       = random_password.master_password.result
  
  vpc_security_group_ids = [aws_security_group.aurora.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  skip_final_snapshot    = true
  
  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 1.0
  }
  
  tags = {
    Name        = "${var.project_name}-aurora"
    Environment = var.environment
  }
}

# Aurora Serverless v2 instance
resource "aws_rds_cluster_instance" "main" {
  cluster_identifier = aws_rds_cluster.main.id
  instance_class    = "db.serverless"
  engine           = aws_rds_cluster.main.engine
  engine_version   = aws_rds_cluster.main.engine_version
  
  tags = {
    Name        = "${var.project_name}-aurora-instance"
    Environment = var.environment
  }
}

# Generate random password for master user
resource "random_password" "master_password" {
  length  = 16
  special = true
}

# Store master password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.project_name}/${var.environment}/db-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.master_password.result
}

# DB subnet group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}"
  subnet_ids = var.private_subnets
  
  tags = {
    Name        = "${var.project_name}-subnet-group"
    Environment = var.environment
  }
}

# Security group for Aurora
resource "aws_security_group" "aurora" {
  name        = "${var.project_name}-${var.environment}-aurora-sg"
  description = "Security group for Aurora Serverless v2"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.lambda_security_group_id]
  }
  
  tags = {
    Name        = "${var.project_name}-aurora-sg"
    Environment = var.environment
  }
} 