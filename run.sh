#!/bin/bash

# 设置环境变量
export PYTHONPATH=/var/task
export FLASK_APP=application.py

# 如果是 Lambda 环境
if [ -n "$AWS_LAMBDA_FUNCTION_NAME" ]; then
    # 在 Lambda 中使用 awsgi2
    exec python -m awsgi2 application:app
else
    # 在本地环境使用 Gunicorn
    exec gunicorn --bind 0.0.0.0:8000 \
        --workers 3 \
        --timeout 120 \
        --access-logfile - \
        --error-logfile - \
        application:app
fi 