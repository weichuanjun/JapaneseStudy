from flask import Flask
from models import db
from migrations import forum_tables
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler()
    ]
)

def create_app():
    """创建Flask应用"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///japanese_study.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app

def run_migrations():
    """运行数据库迁移"""
    try:
        app = create_app()
        with app.app_context():
            logging.info("开始数据库迁移...")
            
            # 运行论坛表迁移
            logging.info("创建掲示板相关表...")
            forum_tables.upgrade()
            logging.info("掲示板表创建成功")
            
            # 创建AI助手用户（如果不存在）
            from models import User
            momo = User.query.filter_by(username='momo').first()
            if not momo:
                logging.info("创建AI助手用户 'momo'...")
                momo = User(username='momo')
                momo.set_password('ai_assistant_password')  # 设置一个安全的密码
                db.session.add(momo)
                db.session.commit()
                logging.info("AI助手用户创建成功")
            
            logging.info("数据库迁移完成")
            
    except Exception as e:
        logging.error(f"迁移过程中出错: {str(e)}", exc_info=True)
        raise

if __name__ == '__main__':
    run_migrations() 