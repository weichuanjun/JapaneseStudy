#!/bin/bash

# 设置错误时退出
set -e

# 检查 AWS 凭证
echo "检查 AWS 凭证..."
aws sts get-caller-identity >/dev/null 2>&1 || {
    echo "AWS 凭证无效，请检查配置"
    exit 1
}

# 检查环境变量文件
if [ ! -f .env.prod ]; then
    echo ".env.prod 文件不存在，终止部署"
    exit 1
fi

# 设置环境变量
set -a
source .env.prod
set +a

# 等待堆栈状态稳定
wait_for_stack_stability() {
    local stack_name=$1
    local max_attempts=30
    local attempt=1
    local wait_time=20

    echo "等待堆栈状态稳定..."
    while [ $attempt -le $max_attempts ]; do
        local status=$(aws cloudformation describe-stacks --stack-name $stack_name --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "STACK_NOT_FOUND")
        
        case $status in
            *COMPLETE|*FAILED|STACK_NOT_FOUND)
                echo "堆栈状态: $status"
                return 0
                ;;
            *)
                echo "堆栈状态: $status，等待 $wait_time 秒..."
                sleep $wait_time
                ;;
        esac
        attempt=$((attempt + 1))
    done

    echo "等待超时，堆栈状态仍未稳定"
    return 1
}

echo "开始部署..."

# 清理构建目录
echo "清理构建目录..."
rm -rf .aws-sam/

# 构建应用
echo "构建应用..."
sam build --use-container || {
    echo "构建失败，请检查日志"
    exit 1
}

# 检查并等待堆栈状态稳定
STACK_NAME="japanese-study"
wait_for_stack_stability $STACK_NAME

# 检查堆栈是否存在
if aws cloudformation describe-stacks --stack-name $STACK_NAME >/dev/null 2>&1; then
    echo "更新现有堆栈..."
    # 更新现有堆栈
    sam deploy \
        --no-fail-on-empty-changeset \
        --no-confirm-changeset || {
        echo "部署失败，请检查日志"
        exit 1
    }
else
    echo "创建新堆栈..."
    # 创建新堆栈
    sam deploy || {
        echo "部署失败，请检查日志"
        exit 1
    }
fi

# 等待部署完成
echo "等待部署完成..."
wait_for_stack_stability $STACK_NAME

# 检查堆栈状态
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].StackStatus' --output text)
echo "堆栈状态: $STACK_STATUS"

if [ "$STACK_STATUS" != "CREATE_COMPLETE" ] && [ "$STACK_STATUS" != "UPDATE_COMPLETE" ]; then
    echo "堆栈创建/更新失败，状态: $STACK_STATUS"
    echo "检查失败的资源..."
    aws cloudformation describe-stack-events \
        --stack-name $STACK_NAME \
        --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
        --output table
    exit 1
fi

# 获取 S3 存储桶名称
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`StaticBucketName`].OutputValue' --output text 2>/dev/null)

if [ -z "$S3_BUCKET" ]; then
    echo "无法获取 S3_BUCKET，可能是 CloudFormation 堆栈未正确创建"
    exit 1
fi

# 获取 CloudFront 域名
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' --output text 2>/dev/null)

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
    echo "无法获取 CLOUDFRONT_DOMAIN，可能是 CloudFormation 堆栈未正确创建"
    exit 1
fi

# 上传静态文件
if [ -d "static" ]; then
    echo "上传静态文件到 S3..."
    aws s3 sync static/ s3://$S3_BUCKET/static/ --delete >/dev/null 2>&1 || {
        echo "静态文件上传失败"
        exit 1
    }
    echo "静态文件上传成功"
else
    echo "警告：static 目录不存在，跳过上传"
fi

# 上传模板文件
if [ -d "templates" ]; then
    echo "上传模板文件..."
    aws s3 sync templates/ s3://$S3_BUCKET/templates/ --delete >/dev/null 2>&1 || {
        echo "模板文件上传失败"
        exit 1
    }
    echo "模板文件上传成功"
else
    echo "警告：templates 目录不存在，跳过上传"
fi

# 清除 CloudFront 缓存
echo "清除 CloudFront 缓存..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='$CLOUDFRONT_DOMAIN'].Id" --output text 2>/dev/null)

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "无法获取 CloudFront Distribution ID，可能是 CloudFormation 配置错误"
    exit 1
fi

aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*" >/dev/null 2>&1 || {
    echo "清除 CloudFront 缓存失败"
    exit 1
}
echo "CloudFront 缓存清除成功"

echo "部署完成！"
echo "应用 URL: https://$CLOUDFRONT_DOMAIN"

# 显示其他重要输出
echo "其他重要信息："
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
    --output table 2>/dev/null 