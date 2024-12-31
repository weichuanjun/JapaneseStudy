from models import db
import sqlite3
import logging

def migrate_database():
    try:
        # 连接到数据库
        conn = sqlite3.connect('japanese_study.db')
        cursor = conn.cursor()

        # 创建用户表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(80) UNIQUE NOT NULL,
            password_hash VARCHAR(128),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_practice DATETIME,
            streak_days INTEGER DEFAULT 0
        )
        ''')

        # 创建阅读记录表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS reading_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            practice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            content TEXT NOT NULL,
            accuracy_score FLOAT,
            fluency_score FLOAT,
            completeness_score FLOAT,
            pronunciation_score FLOAT,
            words_omitted TEXT,
            words_inserted TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        ''')

        # 创建话题记录表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS topic_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            practice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
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

        # 检查是否需要添加新列
        def add_column_if_not_exists(table, column, type_):
            try:
                cursor.execute(f'ALTER TABLE {table} ADD COLUMN {column} {type_}')
                print(f'Added column {column} to {table}')
            except sqlite3.OperationalError as e:
                if 'duplicate column name' not in str(e).lower():
                    raise e

        # 添加新列（如果不存在）
        add_column_if_not_exists('users', 'last_practice', 'DATETIME')
        add_column_if_not_exists('users', 'streak_days', 'INTEGER DEFAULT 0')
        add_column_if_not_exists('topic_records', 'grammar_correction', 'TEXT')

        # 提交更改
        conn.commit()
        print("数据库迁移成功完成")

    except Exception as e:
        print(f"迁移过程中出错: {str(e)}")
        raise e

    finally:
        # 关闭连接
        conn.close()

if __name__ == '__main__':
    migrate_database() 