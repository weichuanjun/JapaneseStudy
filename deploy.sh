#!/bin/bash

# 更新系统包
sudo apt-get update
sudo apt-get upgrade -y

# 安装必要的系统包
sudo apt-get install -y python3-pip python3-dev build-essential libssl-dev libffi-dev python3-setuptools python3-venv nginx git

# 创建项目目录
mkdir -p /home/ubuntu/JapaneseStudy
cd /home/ubuntu/JapaneseStudy

# 创建并激活虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install -r requirements.txt

# 创建日志目录
mkdir -p logs

# 初始化数据库
flask db upgrade

# 配置 Nginx
sudo bash -c 'cat > /etc/nginx/sites-available/japanese_study << EOL
server {
    listen 80;
    server_name your_domain.com;  # 替换为你的域名

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOL'

# 启用 Nginx 配置
sudo ln -s /etc/nginx/sites-available/japanese_study /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx

# 创建 systemd 服务
sudo bash -c 'cat > /etc/systemd/system/japanese_study.service << EOL
[Unit]
Description=Japanese Study Gunicorn Daemon
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/JapaneseStudy
Environment="PATH=/home/ubuntu/JapaneseStudy/venv/bin"
ExecStart=/home/ubuntu/JapaneseStudy/venv/bin/gunicorn -c gunicorn_config.py application:app

[Install]
WantedBy=multi-user.target
EOL'

# 启动服务
sudo systemctl daemon-reload
sudo systemctl start japanese_study
sudo systemctl enable japanese_study

echo "部署完成！" 