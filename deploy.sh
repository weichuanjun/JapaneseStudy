#!/bin/bash

# deploy.sh - 部署 Japanese Study App 到 AWS dev 环境

# 设置脚本在遇到错误时立即退出
set -e

# 定义变量 (根据需要修改)
STAGE="dev"
S3_BUCKET="japanese-study-app-static-${STAGE}" # S3 桶名称根据 serverless.yml 动态生成
CLOUDFRONT_DISTRIBUTION_ID="E2E11OFDLYYCXV" # 您的 CloudFront 分发 ID

# 1. 部署 Serverless 应用
echo ">>> (1/4) Deploying Serverless stack to stage '${STAGE}'..."
serverless deploy --stage ${STAGE}
echo ">>> Serverless deployment complete."
echo ""

# 2. 同步 'static' 文件夹到 S3
echo ">>> (2/4) Syncing 'static' directory to S3 bucket '${S3_BUCKET}'..."
aws s3 sync static s3://${S3_BUCKET}/static --delete
echo ">>> 'static' directory sync complete."
echo ""

# 3. 同步 'templates' 文件夹到 S3
echo ">>> (3/4) Syncing 'templates' directory to S3 bucket '${S3_BUCKET}'..."
aws s3 sync templates s3://${S3_BUCKET}/templates --delete
echo ">>> 'templates' directory sync complete."
echo ""

# 4. 创建 CloudFront 失效请求
echo ">>> (4/4) Creating CloudFront invalidation for distribution ID '${CLOUDFRONT_DISTRIBUTION_ID}'..."
aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths "/*"
echo ">>> CloudFront invalidation created. Please wait a few minutes for it to propagate globally."
echo ""

echo ">>> Deployment process completed successfully!" 