"""掲示板数据库迁移脚本"""
from models import db

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

def downgrade():
    """降级数据库，删除掲示板相关的表"""
    db.engine.execute("DROP TABLE IF EXISTS comments")
    db.engine.execute("DROP TABLE IF EXISTS posts") 