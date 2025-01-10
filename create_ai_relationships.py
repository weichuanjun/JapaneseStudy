import sqlite3
import logging
import os

def create_tables():
    try:
        # 确保instance目录存在
        if not os.path.exists('instance'):
            os.makedirs('instance')
            
        # 连接到数据库
        conn = sqlite3.connect('instance/japanese_study.db')
        cursor = conn.cursor()
        
        # 读取SQL文件
        with open('create_ai_relationships.sql', 'r') as sql_file:
            sql_script = sql_file.read()
            
        # 执行SQL脚本
        cursor.executescript(sql_script)
        
        # 提交更改
        conn.commit()
        logging.info("AI关系表创建成功")
        
    except Exception as e:
        logging.error(f"创建AI关系表失败: {str(e)}")
        raise
    finally:
        # 关闭连接
        cursor.close()
        conn.close()

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    create_tables()
    print("AI关系表创建完成！") 