import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
import json
import logging
from models import db
from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('sample_words_import.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__)

# 从环境变量获取数据库配置
DB_USER = os.getenv('POSTGRES_USER')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD')
DB_HOST = os.getenv('POSTGRES_HOST')
DB_PORT = os.getenv('POSTGRES_PORT')
DB_NAME = os.getenv('POSTGRES_DB')

# 构建数据库URI
SQLALCHEMY_DATABASE_URI = f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'

app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# 定义新的词汇表模型
class SystemVocabulary(db.Model):
    __tablename__ = 'system_vocabulary'
    
    id = Column(Integer, primary_key=True)
    word = Column(String(100), nullable=False)
    reading = Column(String(100), nullable=False)
    meaning = Column(String(100), nullable=False)
    example = Column(Text)
    example_reading = Column(Text)
    example_meaning = Column(Text)
    category = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<SystemVocabulary {self.word}>'

def init_vocabulary_table():
    """初始化系统词汇表"""
    logger.info("开始初始化系统词汇表...")
    with app.app_context():
        try:
            # 如果表存在，先删除
            if SystemVocabulary.__table__.exists(db.engine):
                SystemVocabulary.__table__.drop(db.engine)
                logger.info("已删除旧的系统词汇表")
            
            # 创建新表
            SystemVocabulary.__table__.create(db.engine)
            logger.info("成功创建新的系统词汇表")
            return True
        except Exception as e:
            logger.error(f"初始化系统词汇表时出错: {str(e)}")
            return False

def import_words():
    """导入示例单词到数据库"""
    try:
        # 读取JSON文件
        with open('db-migrate/sample_words.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        with app.app_context():
            total_count = 0
            # 遍历每个类别
            for category, words in data.items():
                logger.info(f"开始导入 {category} 类别的单词...")
                
                for word_data in words:
                    try:
                        # 检查是否已存在
                        existing = SystemVocabulary.query.filter_by(
                            word=word_data['word'],
                            category=category
                        ).first()
                        
                        if not existing:
                            vocabulary = SystemVocabulary(
                                word=word_data['word'],
                                reading=word_data['reading'],
                                meaning=word_data['meaning'],
                                example=word_data['example'],
                                example_reading=word_data['example_reading'],
                                example_meaning=word_data['example_meaning'],
                                category=category
                            )
                            db.session.add(vocabulary)
                            total_count += 1
                            logger.info(f"成功添加单词: {word_data['word']}")
                        else:
                            logger.info(f"单词已存在，跳过: {word_data['word']}")
                            
                    except Exception as e:
                        logger.error(f"保存单词时出错: {str(e)}")
                        db.session.rollback()
                        continue
                        
            db.session.commit()
            logger.info(f"导入完成！总共导入 {total_count} 个单词")
            
    except Exception as e:
        logger.error(f"导入过程出错: {str(e)}")
        return False
    
    return True

def main():
    logger.info("=== 开始导入示例单词 ===")
    
    # 初始化系统词汇表
    if not init_vocabulary_table():
        logger.error("系统词汇表初始化失败，退出程序")
        return
    
    # 导入单词
    if import_words():
        logger.info("=== 示例单词导入成功 ===")
    else:
        logger.error("=== 示例单词导入失败 ===")

if __name__ == '__main__':
    main() 