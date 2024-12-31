from application import app, db
from models import User

def migrate():
    with app.app_context():
        # 添加 last_practice 列
        db.engine.execute('ALTER TABLE users ADD COLUMN last_practice DATETIME')
        # 添加 streak_days 列
        db.engine.execute('ALTER TABLE users ADD COLUMN streak_days INTEGER DEFAULT 0')
        db.session.commit()
        print("数据库迁移完成")

if __name__ == '__main__':
    migrate() 