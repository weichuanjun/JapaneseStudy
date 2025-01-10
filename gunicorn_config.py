# Gunicorn 配置文件
import multiprocessing
import os

# 绑定的 IP 和端口
bind = "0.0.0.0:5000"

# 工作进程数
workers = multiprocessing.cpu_count() * 2 + 1

# 工作模式
worker_class = "sync"

# 超时时间
timeout = 120

# 允许的最大客户端并发数量
worker_connections = 1000

# 日志配置
accesslog = "logs/access.log"
errorlog = "logs/error.log"
loglevel = "info"

# 允许处理大文件上传
max_requests = 1000
max_requests_jitter = 50
timeout = 300
keepalive = 5 