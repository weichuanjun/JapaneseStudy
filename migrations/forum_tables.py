"""掲示板数据库迁移脚本"""
from models import db, User
from werkzeug.security import generate_password_hash

def upgrade():
    """升级数据库，添加掲示板相关的表"""
    # 创建posts表
    db.engine.execute("""
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)

    # 创建comments表
    db.engine.execute("""
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    
    # 创建 momo 用户（如果不存在）
    momo = User.query.filter_by(username='momo').first()
    if not momo:
        # 直接插入固定 ID 的 momo 用户
        db.engine.execute("""
        INSERT OR IGNORE INTO users (id, username, password_hash, created_at)
        VALUES (9999999, 'momo', ?, datetime('now'))
        """, (generate_password_hash('momo_ai_assistant'),))
        print("Created momo user with ID 9999999")
    else:
        # 如果 momo 已存在但 ID 不是 9999999，更新它
        if momo.id != 9999999:
            old_id = momo.id
            try:
                # 更新所有相关表中的引用
                db.engine.execute(f"UPDATE posts SET user_id = 9999999 WHERE user_id = {old_id}")
                db.engine.execute(f"UPDATE comments SET user_id = 9999999 WHERE user_id = {old_id}")
                db.engine.execute(f"UPDATE users SET id = 9999999 WHERE id = {old_id}")
                print(f"Updated momo user ID from {old_id} to 9999999")
            except Exception as e:
                print(f"Error updating momo user ID: {e}")
        else:
            print("Momo user already exists with correct ID 9999999")

def downgrade():
    """降级数据库，删除掲示板相关的表"""
    db.engine.execute("DROP TABLE IF EXISTS comments")
    db.engine.execute("DROP TABLE IF EXISTS posts")

    # 删除 momo 用户
    momo = User.query.filter_by(username='momo').first()
    if momo:
        db.session.delete(momo)
        db.session.commit()
        print("Deleted momo user") 