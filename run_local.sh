#!/bin/bash

# 创建日志目录
mkdir -p logs

# 激活虚拟环境（如果存在）
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 设置环境变量
export FLASK_APP=application.py
export FLASK_ENV=development

# 使用 Gunicorn 启动应用
gunicorn -c gunicorn_config.py application:app 