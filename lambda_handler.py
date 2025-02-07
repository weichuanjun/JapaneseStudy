import json
from application import app
import awsgi2

def handler(event, context):
    # 统一处理 API Gateway 不同版本的事件格式
    if event.get('version') == '2.0':  # HTTP API v2.0
        request_context = event.get('requestContext', {})
        http_info = request_context.get('http', {})
        
        # 转换为兼容 WSGI 的 v1 格式
        v1_event = {
            'path': event.get('rawPath', '/'),
            'httpMethod': http_info.get('method', 'GET'),
            'headers': event.get('headers', {}),
            'queryStringParameters': event.get('queryStringParameters', {}),
            'multiValueQueryStringParameters': event.get('queryStringParameters', {}),  # 伪多值，按需调整
            'body': event.get('body', ''),
            'isBase64Encoded': event.get('isBase64Encoded', False),
            'requestContext': {
                'identity': {
                    'sourceIp': http_info.get('sourceIp', '')
                }
            }
        }
        event = v1_event
    else:  # REST API v1.0 或其他格式
        # 确保 path 存在且以 / 开头
        event.setdefault('path', '/')
        if not event['path'].startswith('/'):
            event['path'] = '/' + event['path']
        
        # 如果是根路径请求，确保使用正确的路径
        if event['path'] == '/':
            event['path'] = '/'
            if not event.get('queryStringParameters'):
                event['queryStringParameters'] = {}
            if not event.get('multiValueQueryStringParameters'):
                event['multiValueQueryStringParameters'] = {}

    # 调用 Flask 应用处理请求
    return awsgi2.response(app, event, context)