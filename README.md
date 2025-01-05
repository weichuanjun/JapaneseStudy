# 日本語学習プラットフォーム (Japanese Learning Platform)

一个现代化的日语学习平台，集成了 AI 技术，提供多样化的学习体验。

## 主要功能

- 📊 学习数据可视化仪表盘
- 🎯 JLPT 各级别词汇学习
- 🎤 AI 辅助发音练习
- 💬 主题会话练习
- 📝 学习社区论坛
- 📱 响应式设计，支持移动端

## 技术特点

- 基于 Flask 的现代 Web 应用
- 集成 Azure Speech Services 实现语音识别
- 使用 Google Gemini API 提供智能学习建议
- 响应式 UI 设计
- 实时数据统计和可视化

## 快速开始

### 环境要求

- Python 3.6+
- pip
- 虚拟环境工具 (推荐)

### 安装步骤

1. 克隆代码库
```bash
git clone [repository-url]
cd japanese-learning-platform
```

2. 创建并激活虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. 安装依赖
```bash
pip install -r requirements.txt
```

4. 配置环境变量
```bash
cp config.example.py config.py
# 编辑 config.py 添加必要的配置信息
```

5. 初始化数据库
```bash
flask db upgrade
```

6. 运行应用
```bash
flask run
```

访问 http://localhost:5000 开始使用

## 配置说明

需要配置以下服务：

1. Azure Speech Services
   - 用于语音识别和发音评估
   - 需要设置 API 密钥和区域

2. Google Gemini API
   - 用于生成学习内容和建议
   - 需要配置 API 密钥

## 开发指南

### 代码结构

```
JapaneseStudy/
├── static/          # 静态资源
├── templates/       # 页面模板
├── models.py        # 数据模型
├── vocabulary.py    # 词汇学习模块
├── application.py   # 主应用
└── config.py        # 配置文件
```

### 开发规范

- 遵循 PEP 8 编码规范
- 使用 Black 进行代码格式化
- 使用 Flake8 进行代码检查
- 编写单元测试

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

