import json
from application import app
import awsgi2
import logging
import sys
import traceback
from datetime import datetime
from flask import request

# 配置根日志记录器
root_logger = logging.getLogger()
if root_logger.handlers:
    for handler in root_logger.handlers:
        root_logger.removeHandler(handler)

# 配置控制台处理器
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s')
console_handler.setFormatter(formatter)
root_logger.addHandler(console_handler)
root_logger.setLevel(logging.DEBUG)

# 确保其他模块的日志也能显示
logging.getLogger('boto3').setLevel(logging.INFO)
logging.getLogger('botocore').setLevel(logging.INFO)
logging.getLogger('urllib3').setLevel(logging.INFO)
logging.getLogger('werkzeug').setLevel(logging.DEBUG)
logging.getLogger('flask').setLevel(logging.DEBUG)

def log_request_details(event):
    """记录请求的详细信息"""
    try:
        headers = event.get('headers', {})
        logging.info("=== 请求详情开始 ===")
        logging.info(f"时间: {datetime.now().isoformat()}")
        logging.info(f"路径: {event.get('path', '/')}")
        logging.info(f"方法: {event.get('httpMethod', 'GET')}")
        logging.info(f"查询参数: {json.dumps(event.get('queryStringParameters', {}), ensure_ascii=False)}")
        logging.info(f"来源IP: {headers.get('X-Forwarded-For', '')}")
        logging.info(f"Host: {headers.get('Host', '')}")
        logging.info(f"User-Agent: {headers.get('User-Agent', '')}")
        logging.info(f"Referer: {headers.get('Referer', '')}")
        logging.info(f"Accept: {headers.get('Accept', '')}")
        logging.info(f"CloudFront-Forwarded-Proto: {headers.get('CloudFront-Forwarded-Proto', '')}")
        logging.info(f"CloudFront-Is-Desktop-Viewer: {headers.get('CloudFront-Is-Desktop-Viewer', '')}")
        logging.info("=== 请求头详情 ===")
        for key, value in headers.items():
            logging.info(f"{key}: {value}")
        logging.info("=== 请求头详情结束 ===")
        
        # 记录请求体（如果存在）
        if 'body' in event and event['body']:
            try:
                body = event['body']
                if event.get('isBase64Encoded', False):
                    import base64
                    body = base64.b64decode(body).decode('utf-8')
                if isinstance(body, str):
                    try:
                        body_json = json.loads(body)
                        logging.info(f"请求体 (JSON): {json.dumps(body_json, ensure_ascii=False)}")
                    except json.JSONDecodeError:
                        logging.info(f"请求体 (Raw): {body}")
            except Exception as e:
                logging.warning(f"无法解析请求体: {str(e)}")
        logging.info("=== 请求详情结束 ===")
    except Exception as e:
        logging.error(f"记录请求详情时出错: {str(e)}")

def handler(event, context):
    """Lambda handler 函数"""
    request_id = context.aws_request_id
    logging.info(f"=== 开始处理新请求 [RequestId: {request_id}] ===")
    
    try:
        # 记录请求详情
        log_request_details(event)
        
        # 记录 Lambda 上下文信息
        logging.info(f"=== Lambda 上下文 ===")
        logging.info(f"函数名称: {context.function_name}")
        logging.info(f"函数版本: {context.function_version}")
        logging.info(f"内存限制: {context.memory_limit_in_mb}MB")
        logging.info(f"剩余执行时间: {context.get_remaining_time_in_millis()}ms")
        
        # 统一处理 API Gateway 不同版本的事件格式
        if event.get('version') == '2.0':
            logging.info(f"[{request_id}] 处理 HTTP API v2.0 请求")
            request_context = event.get('requestContext', {})
            http_info = request_context.get('http', {})
            
            v1_event = {
                'path': event.get('rawPath', '/'),
                'httpMethod': http_info.get('method', 'GET'),
                'headers': event.get('headers', {}),
                'queryStringParameters': event.get('queryStringParameters', {}),
                'multiValueQueryStringParameters': event.get('queryStringParameters', {}),
                'body': event.get('body', ''),
                'isBase64Encoded': event.get('isBase64Encoded', False),
                'requestContext': {
                    'identity': {
                        'sourceIp': http_info.get('sourceIp', '')
                    }
                }
            }
            logging.debug(f"[{request_id}] 转换后的v1事件: {json.dumps(v1_event, ensure_ascii=False)}")
            event = v1_event
        else:
            logging.info(f"[{request_id}] 处理 REST API v1.0 请求")
            event.setdefault('path', '/')
            if not event['path'].startswith('/'):
                event['path'] = '/' + event['path']
            
            if event['path'] == '/':
                if not event.get('queryStringParameters'):
                    event['queryStringParameters'] = {}
                if not event.get('multiValueQueryStringParameters'):
                    event['multiValueQueryStringParameters'] = {}

        logging.info(f"[{request_id}] 开始处理路径: {event['path']} [{event['httpMethod']}]")
        
        try:
            # 调用 Flask 应用处理请求
            logging.info(f"[{request_id}] 准备调用 Flask 应用...")
            response = awsgi2.response(app, event, context)
            status_code = response.get('statusCode', 500)
            logging.info(f"[{request_id}] Flask 应用处理完成 - 状态码: {status_code}")
            
            # 记录响应详情
            logging.info(f"[{request_id}] === 响应详情开始 ===")
            logging.info(f"状态码: {status_code}")
            if 'headers' in response:
                logging.info("响应头:")
                for key, value in response.get('headers', {}).items():
                    logging.info(f"{key}: {value}")
            
            if 'body' in response:
                try:
                    body = response['body']
                    if isinstance(body, str):
                        try:
                            body_json = json.loads(body)
                            logging.info(f"响应体 (JSON): {json.dumps(body_json, ensure_ascii=False)}")
                        except json.JSONDecodeError:
                            if len(body) > 1000:
                                logging.info(f"响应体 (Raw, 前1000字符): {body[:1000]}...")
                                logging.info(f"响应体总长度: {len(body)}")
                            else:
                                logging.info(f"响应体 (Raw): {body}")
                except Exception as e:
                    logging.warning(f"无法记录响应体: {str(e)}")
            logging.info(f"[{request_id}] === 响应详情结束 ===")
            
            return response
            
        except Exception as e:
            logging.error(f"[{request_id}] Flask应用处理请求时出错:")
            logging.error(f"错误类型: {type(e).__name__}")
            logging.error(f"错误信息: {str(e)}")
            logging.error("堆栈跟踪:")
            logging.error(traceback.format_exc())
            raise
            
    except Exception as e:
        logging.error(f"[{request_id}] Lambda处理请求时出错:")
        logging.error(f"错误类型: {type(e).__name__}")
        logging.error(f"错误信息: {str(e)}")
        logging.error("堆栈跟踪:")
        logging.error(traceback.format_exc())
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': str(e),
                'request_id': request_id
            }, ensure_ascii=False)
        }
    finally:
        logging.info(f"=== 请求处理结束 [RequestId: {request_id}] ===")