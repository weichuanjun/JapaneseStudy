from app.application import app
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    ) 