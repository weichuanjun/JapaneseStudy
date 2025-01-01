import sqlite3
from datetime import datetime

def migrate():
    conn = sqlite3.connect('japanese_study.db')
    c = conn.cursor()

    # 创建用户表
    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_practice TIMESTAMP,
        streak_days INTEGER DEFAULT 0
    )
    ''')

    # 创建阅读记录表
    c.execute('''
    CREATE TABLE IF NOT EXISTS reading_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        practice_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        content TEXT NOT NULL,
        accuracy_score REAL,
        fluency_score REAL,
        completeness_score REAL,
        pronunciation_score REAL,
        words_omitted TEXT,
        words_inserted TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')

    # 创建话题记录表
    c.execute('''
    CREATE TABLE IF NOT EXISTS topic_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        practice_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        topic TEXT NOT NULL,
        response TEXT NOT NULL,
        grammar_score INTEGER,
        content_score INTEGER,
        relevance_score INTEGER,
        feedback TEXT,
        grammar_correction TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')

    # 创建词汇记录表
    c.execute('''
    CREATE TABLE IF NOT EXISTS vocabulary_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        word TEXT NOT NULL,
        category TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')

    conn.commit()
    conn.close()

if __name__ == '__main__':
    migrate() 