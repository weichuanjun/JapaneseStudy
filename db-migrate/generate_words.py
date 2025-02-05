import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
import google.generativeai as genai
import json
import logging
import time
from models import db, Vocabulary
from config import GEMINI_API_KEY, GEMINI_MODEL
import random

# 配置日志 - 同时输出到文件和控制台，并设置格式
class ColoredFormatter(logging.Formatter):
    """自定义日志格式器，添加颜色"""
    grey = "\x1b[38;21m"
    blue = "\x1b[36;21m"
    yellow = "\x1b[33;21m"
    red = "\x1b[31;21m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    
    FORMATS = {
        logging.DEBUG: grey + "%(asctime)s [%(levelname)s] %(message)s" + reset,
        logging.INFO: blue + "%(asctime)s [%(levelname)s] %(message)s" + reset,
        logging.WARNING: yellow + "%(asctime)s [%(levelname)s] %(message)s" + reset,
        logging.ERROR: red + "%(asctime)s [%(levelname)s] %(message)s" + reset,
        logging.CRITICAL: bold_red + "%(asctime)s [%(levelname)s] %(message)s" + reset
    }
    
    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt, datefmt='%Y-%m-%d %H:%M:%S')
        return formatter.format(record)

# 配置日志处理器
logger = logging.getLogger('WordGenerator')
logger.setLevel(logging.INFO)

# 文件处理器
file_handler = logging.FileHandler('word_generation.log', encoding='utf-8')
file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
logger.addHandler(file_handler)

# 控制台处理器
console_handler = logging.StreamHandler()
console_handler.setFormatter(ColoredFormatter())
logger.addHandler(console_handler)

# 创建Flask应用
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:postgres@localhost/japanese_study'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

def init_db():
    """初始化数据库"""
    logger.info("开始初始化数据库...")
    with app.app_context():
        try:
            # 删除所有表（如果存在）
            db.drop_all()
            logger.info("已清除旧表")
            
            # 创建所有表
            db.create_all()
            logger.info("已创建新表")
            return True
        except Exception as e:
            logger.error(f"初始化数据库时出错: {str(e)}")
            return False

# 配置Gemini API
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
    logger.info("Gemini API 配置成功")
except Exception as e:
    logger.error(f"Gemini API 配置失败: {str(e)}")
    raise

CATEGORIES = {
    'n1': 'JLPT N1 词汇',
    'n2': 'JLPT N2 词汇'
}

def generate_word_prompt(category):
    logger.info(f"生成 {CATEGORIES[category]} 的提示词...")
    return f"""You are a Japanese language teacher. Generate a vocabulary quiz for {CATEGORIES[category]} level.
Return a JSON array containing 10 vocabulary items with the following format for each item (no additional text or explanation).

Here's an example of the expected format:
[
    {{
        "word": "食べる",
        "reading": "たべる",
        "meaning": "吃",
        "options": ["吃", "喝", "走", "跑"],
        "example": "私は毎日ここで昼ごはんを食べます。",
        "example_reading": "わたしはまいにちここでひるごはんをたべます。",
        "example_meaning": "我每天在这里吃午饭。"
    }},
    // ... more items ...
]

Requirements:
1. The word should be in Japanese Kanji (if applicable) or Hiragana if no Kanji exists
2. The reading must be in Hiragana only (no Kanji or Katakana)
3. The meaning and all options must be in Chinese (Simplified Chinese)
4. The example sentence must use the word in a natural context
5. The first option in "options" array must be the correct meaning
6. All wrong options must be plausible but clearly different from the correct meaning
7. The example sentence must be simple and natural Japanese
8. Ensure all Japanese text uses proper Japanese characters (not Unicode escapes)
9. The options array must contain exactly 4 items
10. For N1 and N2 level words, use appropriate advanced vocabulary"""

def validate_word_data(word_data):
    """验证单词数据的格式和内容"""
    required_fields = ['word', 'reading', 'meaning', 'options', 'example', 'example_reading', 'example_meaning']
    
    # 检查所有必需字段
    for field in required_fields:
        if field not in word_data:
            return False, f"Missing required field: {field}"
            
    # 验证选项数量
    if not isinstance(word_data['options'], list) or len(word_data['options']) != 4:
        return False, "Options must contain exactly 4 items"
        
    # 验证第一个选项是否与meaning相同
    if word_data['options'][0] != word_data['meaning']:
        return False, "First option must be the correct meaning"
        
    return True, None

def generate_words_with_gemini(category, count=10):
    """使用Gemini API生成单词数据"""
    words = []
    attempts = 0
    max_attempts = 10
    
    while len(words) < count and attempts < max_attempts:
        try:
            prompt = generate_word_prompt(category)
            generation_config = {
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 2048,
            }
            
            logger.info(f"正在调用 Gemini API 生成第 {len(words)}/{count} 批单词...")
            response = model.generate_content(prompt, generation_config=generation_config)
            
            if not response or not response.text:
                logger.error("Gemini API 返回空响应")
                attempts += 1
                continue
                
            # 解析JSON响应
            text = response.text
            json_start = text.find('[')
            json_end = text.rfind(']') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = text[json_start:json_end]
                batch_words = json.loads(json_str)
                
                # 验证每个单词
                for word_data in batch_words:
                    is_valid, error = validate_word_data(word_data)
                    if is_valid:
                        words.append(word_data)
                        logger.info(f"成功生成单词: {word_data['word']} ({len(words)}/{count})")
                        if len(words) >= count:
                            break
                    else:
                        logger.warning(f"单词验证失败: {error}")
            
            time.sleep(1)  # 避免请求过快
            
        except Exception as e:
            logger.error(f"生成单词时出错: {str(e)}")
            attempts += 1
            time.sleep(2)
            
    return words[:count]

def save_words_to_db(words, category):
    """保存单词到数据库"""
    success_count = 0
    with app.app_context():
        for word_data in words:
            try:
                # 检查是否已存在
                existing = Vocabulary.query.filter_by(
                    word=word_data['word'],
                    category=category
                ).first()
                
                if not existing:
                    vocabulary = Vocabulary(
                        user_id=None,  # 系统生成的单词，user_id为空
                        word=word_data['word'],
                        reading=word_data['reading'],
                        meaning=word_data['meaning'],
                        example=word_data['example'],
                        example_reading=word_data['example_reading'],
                        example_meaning=word_data['example_meaning'],
                        category=category
                    )
                    db.session.add(vocabulary)
                    success_count += 1
                    logger.info(f"成功添加单词: {word_data['word']}")
                else:
                    logger.info(f"单词已存在，跳过: {word_data['word']}")
                    
            except Exception as e:
                logger.error(f"保存单词时出错: {str(e)}")
                db.session.rollback()
                continue
                
        db.session.commit()
        logger.info(f"本批次成功保存 {success_count} 个单词到数据库")
    return success_count

def main():
    logger.info("=== 开始单词生成任务 ===")
    
    # 初始化数据库
    if not init_db():
        logger.error("数据库初始化失败，退出程序")
        return
        
    words_per_category = 500  # 每个类别生成500个单词，总共1000个
    total_success = 0
    
    for category in CATEGORIES.keys():
        logger.info(f"=== 开始处理 {CATEGORIES[category]} ===")
        words = generate_words_with_gemini(category, words_per_category)
        logger.info(f"成功生成 {len(words)} 个 {category} 单词")
        
        logger.info(f"开始保存 {category} 类别的单词到数据库")
        success_count = save_words_to_db(words, category)
        total_success += success_count
        logger.info(f"完成保存 {category} 类别的单词")
        
    logger.info(f"=== 任务完成！总共成功生成并保存 {total_success} 个单词 ===")

if __name__ == '__main__':
    main() 