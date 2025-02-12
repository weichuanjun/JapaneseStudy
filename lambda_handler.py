import json
import os
import sys

# 导入 Flask 应用
from app.application import app
import awsgi2
import logging

# 配置基本日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def handler(event, context):
    """
    Lambda handler 函数
    用于处理来自 API Gateway 的请求并转发给 Flask 应用
    """
    try:
        # 统一处理 API Gateway v1 和 v2 的事件格式
        if event.get('version') == '2.0':
            # 转换 HTTP API v2 格式为 v1 格式
            request_context = event.get('requestContext', {})
            http_info = request_context.get('http', {})
            
            event = {
                'path': event.get('rawPath', '/'),
                'httpMethod': http_info.get('method', 'GET'),
                'headers': event.get('headers', {}),
                'queryStringParameters': event.get('queryStringParameters', {}),
                'body': event.get('body', ''),
                'isBase64Encoded': event.get('isBase64Encoded', False)
            }
        
        # 使用 awsgi2 处理请求
        return awsgi2.response(app, event, context)
        
    except Exception as e:
        logging.error(f"处理请求时出错: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': str(e)
            })
        }