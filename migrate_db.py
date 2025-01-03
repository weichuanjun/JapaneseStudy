import sqlite3
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    filename='migration.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def migrate_database():
    """执行数据库迁移"""
    try:
        # 连接到数据库
        conn = sqlite3.connect('japanese_study.db')
        cursor = conn.cursor()
        
        # 记录迁移开始
        logging.info("开始数据库迁移")
        
        # 检查reading_records表是否存在difficulty列
        cursor.execute("PRAGMA table_info(reading_records)")
        columns = cursor.fetchall()
        has_difficulty = any(column[1] == 'difficulty' for column in columns)
        
        if not has_difficulty:
            logging.info("为reading_records表添加difficulty列")
            cursor.execute("""
                ALTER TABLE reading_records 
                ADD COLUMN difficulty VARCHAR(10) NOT NULL DEFAULT 'medium'
            """)
            
        # 检查topic_records表是否存在difficulty列
        cursor.execute("PRAGMA table_info(topic_records)")
        columns = cursor.fetchall()
        has_difficulty = any(column[1] == 'difficulty' for column in columns)
        
        if not has_difficulty:
            logging.info("为topic_records表添加difficulty列")
            cursor.execute("""
                ALTER TABLE topic_records 
                ADD COLUMN difficulty VARCHAR(10) NOT NULL DEFAULT 'medium'
            """)
            
        # 提交更改
        conn.commit()
        logging.info("数据库迁移成功完成")
        
    except Exception as e:
        logging.error(f"迁移过程中出错: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database() 