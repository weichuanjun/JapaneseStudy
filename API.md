# API 文档

本文档详细说明了日语学习平台的所有 API 端点。

## 目录
- [认证相关](#认证相关)
- [单词学习](#单词学习)
- [发音练习](#发音练习)
- [论坛功能](#论坛功能)
- [用户资料](#用户资料)
- [学习统计](#学习统计)

## 认证相关

### 用户注册
```http
POST /api/auth/register
```

请求体：
```json
{
    "username": "string",
    "email": "string",
    "password": "string"
}
```

响应：
```json
{
    "status": "success",
    "user_id": "string",
    "message": "注册成功"
}
```

### 用户登录
```http
POST /api/auth/login
```

请求体：
```json
{
    "email": "string",
    "password": "string"
}
```

响应：
```json
{
    "status": "success",
    "token": "string",
    "user": {
        "id": "string",
        "username": "string",
        "email": "string"
    }
}
```

## 单词学习

### 获取练习词汇
```http
POST /api/vocabulary/word
```

请求体：
```json
{
    "category": "string",  // n1, n2, n3, n4, n5, daily, business
    "user_id": "string"
}
```

响应：
```json
{
    "word": "string",
    "reading": "string",
    "meaning": "string",
    "options": ["string"],
    "example": "string",
    "example_reading": "string",
    "example_meaning": "string"
}
```

### 记录学习结果
```http
POST /api/vocabulary/record
```

请求体：
```json
{
    "user_id": "string",
    "word": "string",
    "category": "string",
    "is_correct": "boolean"
}
```

响应：
```json
{
    "status": "success"
}
```

### 获取学习统计
```http
GET /api/vocabulary/stats?user_id=string
```

响应：
```json
{
    "total_words": "integer",
    "correct_words": "integer",
    "accuracy": "float",
    "category_stats": {
        "n1": {
            "total": "integer",
            "correct": "integer",
            "accuracy": "float"
        }
        // ... 其他类别
    }
}
```

### 收藏单词
```http
POST /api/vocabulary/favorite
```

请求体：
```json
{
    "user_id": "string",
    "word": "string",
    "reading": "string",
    "meaning": "string",
    "example": "string",
    "example_reading": "string",
    "example_meaning": "string",
    "category": "string"
}
```

响应：
```json
{
    "status": "success"
}
```

### 获取收藏列表
```http
GET /api/vocabulary/favorites?user_id=string
```

响应：
```json
[
    {
        "word": "string",
        "reading": "string",
        "meaning": "string",
        "example": "string",
        "example_reading": "string",
        "example_meaning": "string",
        "category": "string",
        "created_at": "string"
    }
]
```

## 发音练习

### 上传音频
```http
POST /api/speech/upload
```

请求体：
```form-data
{
    "audio": "file",
    "text": "string",
    "user_id": "string"
}
```

响应：
```json
{
    "score": {
        "accuracy": "float",
        "fluency": "float",
        "completeness": "float",
        "pronunciation": "float"
    },
    "feedback": "string"
}
```

### 获取练习历史
```http
GET /api/speech/history?user_id=string
```

响应：
```json
[
    {
        "text": "string",
        "score": {
            "accuracy": "float",
            "fluency": "float",
            "completeness": "float",
            "pronunciation": "float"
        },
        "created_at": "string"
    }
]
```

## 论坛功能

### 获取帖子列表
```http
GET /api/forum/posts?page=integer&limit=integer
```

响应：
```json
{
    "total": "integer",
    "pages": "integer",
    "current_page": "integer",
    "posts": [
        {
            "id": "string",
            "title": "string",
            "content": "string",
            "author": {
                "id": "string",
                "username": "string"
            },
            "created_at": "string",
            "comments_count": "integer"
        }
    ]
}
```

### 创建帖子
```http
POST /api/forum/posts
```

请求体：
```json
{
    "title": "string",
    "content": "string",
    "user_id": "string"
}
```

响应：
```json
{
    "status": "success",
    "post_id": "string"
}
```

### 获取评论
```http
GET /api/forum/posts/{post_id}/comments
```

响应：
```json
[
    {
        "id": "string",
        "content": "string",
        "author": {
            "id": "string",
            "username": "string"
        },
        "created_at": "string"
    }
]
```

## 用户资料

### 获取用户资料
```http
GET /api/users/{user_id}/profile
```

响应：
```json
{
    "username": "string",
    "email": "string",
    "avatar_data": "string",
    "created_at": "string",
    "stats": {
        "total_practices": "integer",
        "total_study_time": "integer",
        "streak_days": "integer",
        "avg_reading_score": "float",
        "avg_topic_score": "float"
    }
}
```

### 更新用户资料
```http
PUT /api/users/{user_id}/profile
```

请求体：
```json
{
    "username": "string",
    "avatar_data": "string",
    "email": "string"
}
```

响应：
```json
{
    "status": "success"
}
```

## 学习统计

### 获取学习数据
```http
GET /api/stats/dashboard?user_id=string
```

响应：
```json
{
    "study_time": {
        "total": "integer",
        "daily_average": "float",
        "weekly_trend": [
            {
                "date": "string",
                "minutes": "integer"
            }
        ]
    },
    "vocabulary": {
        "total_learned": "integer",
        "accuracy_rate": "float",
        "category_distribution": {
            "n1": "integer",
            "n2": "integer",
            // ... 其他类别
        }
    },
    "pronunciation": {
        "total_practices": "integer",
        "average_score": "float",
        "score_trend": [
            {
                "date": "string",
                "score": "float"
            }
        ]
    }
}
```

### 获取排行榜
```http
GET /api/stats/leaderboard?type=string
```

响应：
```json
[
    {
        "rank": "integer",
        "user": {
            "id": "string",
            "username": "string",
            "avatar_data": "string"
        },
        "score": "float",
        "total_time": "integer"
    }
]
```

## 错误响应

所有 API 在发生错误时会返回以下格式：

```json
{
    "error": "string",
    "message": "string",
    "status_code": "integer"
}
```

常见状态码：
- 200: 成功
- 400: 请求参数错误
- 401: 未授权
- 403: 禁止访问
- 404: 资源不存在
- 500: 服务器内部错误

## 认证

除了登录和注册接口，所有 API 请求都需要在 Header 中携带认证信息：

```http
Authorization: Bearer <token>
```

## 请求限制

- 每个 IP 每分钟最多 60 次请求
- 上传文件大小限制：10MB
- 返回数据分页默认大小：20 条/页 