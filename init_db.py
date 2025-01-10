from application import app, db
from ai_personality_init import init_ai_personality

def init_database():
    with app.app_context():
        # 创建所有表
        db.create_all()
        
        # 初始化AI人格
        init_ai_personality()
        
if __name__ == '__main__':
    init_database()
    print("数据库初始化完成！") 