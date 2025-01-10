-- 创建AI关系表
CREATE TABLE IF NOT EXISTS ai_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    affinity_score FLOAT DEFAULT 50.0,  -- 好感度分数，范围0-100
    interaction_count INTEGER DEFAULT 0,  -- 互动次数
    last_interaction_at DATETIME,  -- 最后互动时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建AI互动历史表
CREATE TABLE IF NOT EXISTS ai_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,  -- 用户的输入内容
    response TEXT NOT NULL,  -- AI的回复内容
    sentiment_score FLOAT,  -- 情感分析分数
    interaction_type VARCHAR(50),  -- 互动类型（例如：聊天、学习辅导等）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建AI好感度变化历史表
CREATE TABLE IF NOT EXISTS affinity_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    old_score FLOAT NOT NULL,  -- 变化前的好感度
    new_score FLOAT NOT NULL,  -- 变化后的好感度
    change_reason TEXT,  -- 变化原因
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
); 