from flask import Blueprint, jsonify, request, render_template
from models import db, VocabularyRecord, Vocabulary
from sqlalchemy import text
import json
import logging
import time
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL
import random
import sys

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),  # 改用 StreamHandler
    ]
)

# 配置 Gemini API
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
except Exception as e:
    logging.error(f"Gemini API 配置失败: {str(e)}")
    raise

vocabulary_bp = Blueprint('vocabulary', __name__)

CATEGORIES = {
    'n1': 'JLPT N1 词汇',
    'n2': 'JLPT N2 词汇'
}

def generate_word_prompt(category, performance=None):
    logging.info(f"开始生成单词提示 - 类别: {CATEGORIES[category]}")
    base_prompt = f"""You are a Japanese language teacher. Generate a vocabulary quiz for {CATEGORIES.get(category, 'basic')} level.
Return ONLY a JSON object with the following format (no additional text or explanation).

Here's an example of the expected format:
{{
    "word": "食べる",
    "reading": "たべる",
    "meaning": "吃",
    "options": ["吃", "喝", "走", "跑"],
    "example": "私は毎日ここで昼ごはんを食べます。",
    "example_reading": "わたしはまいにちここでひるごはんをたべます。",
    "example_meaning": "我每天在这里吃午饭。"
}}

Requirements:
1. The word should be in Japanese Kanji (if applicable) or Hiragana if no Kanji exists
2. The reading must be in Hiragana only (no Kanji or Katakana)
3. The meaning and all options must be in Chinese (Simplified Chinese)
4. The example sentence must use the word in a natural context
5. The first option in "options" array must be the correct meaning (it will be shuffled later)
6. All wrong options must be plausible but clearly different from the correct meaning
7. The example sentence must be simple and natural Japanese
8. Do not include any explanations or additional text, just the JSON object
9. Ensure all Japanese text uses proper Japanese characters (not Unicode escapes)
10. The options array must contain exactly 4 items

For N5 level words, use basic vocabulary like:
- 食べる (eat)
- 飲む (drink)
- 行く (go)
- 来る (come)
- 見る (see)
etc.

For N1 level words, use more advanced vocabulary.
For daily words, use common conversational vocabulary.
For business words, use office and workplace vocabulary."""

    if performance:
        correct_rate = performance.get('correct_rate', 0)
        if correct_rate > 0.8:
            base_prompt += "\nPlease increase the difficulty slightly as the user has a high success rate."
            logging.info(f"用户表现优秀（正确率: {correct_rate:.2%}），提高难度")
        elif correct_rate < 0.4:
            base_prompt += "\nPlease decrease the difficulty as the user needs more practice with basics."
            logging.info(f"用户需要帮助（正确率: {correct_rate:.2%}），降低难度")
        else:
            logging.info(f"保持当前难度（正确率: {correct_rate:.2%}）")
    else:
        logging.info("首次学习该类别，使用默认难度")
    
    return base_prompt

def validate_word_data(word_data):
    """验证单词数据的格式和内容"""
    logging.info("开始验证单词数据")
    
    required_fields = ['word', 'reading', 'meaning', 'options', 'example', 'example_reading', 'example_meaning']
    
    # 检查所有必需字段
    for field in required_fields:
        if field not in word_data:
            logging.error(f"缺少必要字段: {field}")
            return False, f"Missing required field: {field}"
            
    # 验证选项数量
    if not isinstance(word_data['options'], list) or len(word_data['options']) != 4:
        logging.error(f"选项数量不正确: {len(word_data['options'])}")
        return False, "Options must contain exactly 4 items"
        
    # 验证第一个选项是否与meaning相同
    if word_data['options'][0] != word_data['meaning']:
        logging.error("第一个选项不是正确答案")
        return False, "First option must be the correct meaning"
        
    # 验证日语文本格式 - 允许汉字（漢字）、平假名、片假名
    def is_japanese_char(c):
        code = ord(c)
        return (
            (0x3040 <= code <= 0x309F) or  # 平假名
            (0x30A0 <= code <= 0x30FF) or  # 片假名
            (0x4E00 <= code <= 0x9FFF) or  # 漢字
            c in ['々', 'ー', '〜']  # 特殊符号
        )
    
    if not all(is_japanese_char(c) for c in word_data['word'] if not c.isspace()):
        logging.error("单词包含非日语字符")
        return False, "Word contains invalid characters"
        
    # 验证读音是否为平假名
    if not all(0x3040 <= ord(c) <= 0x309F or c.isspace() for c in word_data['reading']):
        logging.error("读音不是平假名")
        return False, "Reading must be in Hiragana"
        
    # 验证中文选项
    def is_chinese_char(c):
        code = ord(c)
        return (0x4E00 <= code <= 0x9FFF) or c.isspace()
    
    if not all(is_chinese_char(c) for c in word_data['meaning']):
        logging.error("含义不是中文")
        return False, "Meaning must be in Chinese"
        
    for option in word_data['options']:
        if not all(is_chinese_char(c) for c in option):
            logging.error("选项不是中文")
            return False, "Options must be in Chinese"
            
    logging.info("单词数据验证通过")
    return True, None

def generate_word_with_gemini(prompt):
    """使用Gemini API生成单词数据"""
    try:
        logging.info("开始调用Gemini API生成单词")
        
        # 配置生成参数
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 1024,
        }
        
        # 生成内容
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        if not response or not response.text:
            error_msg = "Gemini API返回空响应"
            logging.error(error_msg)
            return None, error_msg
            
        logging.info("成功收到Gemini响应")
        # 尝试解析JSON
        try:
            # 查找第一个 [ 和最后一个 ] 之间的内容
            text = response.text
            json_start = text.find('[')
            json_end = text.rfind(']') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = text[json_start:json_end]
                words_data = json.loads(json_str)
                
                # 确保返回的是列表
                if not isinstance(words_data, list):
                    error_msg = "响应格式不正确，期望得到单词列表"
                    logging.error(error_msg)
                    return None, error_msg
                    
                # 随机选择一个单词
                word_data = random.choice(words_data)
                logging.info(f"从 {len(words_data)} 个单词中随机选择了一个")
                return word_data, None
            else:
                error_msg = "响应中未找到有效的JSON数据"
                logging.error(error_msg)
                return None, error_msg
        except json.JSONDecodeError as e:
            error_msg = f"JSON解析错误: {str(e)}"
            logging.error(f"{error_msg}\n原始响应: {text}")
            return None, error_msg
            
    except Exception as e:
        error_msg = f"调用Gemini API时出错: {str(e)}"
        logging.error(error_msg, exc_info=True)
        return None, error_msg

@vocabulary_bp.route('/vocabulary')
def vocabulary_page():
    """渲染词汇学习页面"""
    return render_template('vocabulary.html', categories=CATEGORIES)

@vocabulary_bp.route('/api/vocabulary/word', methods=['POST'])
def get_word():
    start_time = time.time()
    logging.info("=== 开始获取单词 ===")
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
            
        category = data.get('category', 'n1')
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        logging.info(f"处理单词请求 - 用户ID: {user_id}, 类别: {CATEGORIES[category]}")
        
        # 获取用户在该类别的表现数据
        performance = None
        records = VocabularyRecord.query.filter_by(
            user_id=user_id,
            category=category
        ).order_by(VocabularyRecord.created_at.desc()).limit(10).all()
        
        if records:
            correct_count = sum(1 for r in records if r.is_correct)
            performance = {
                'correct_rate': correct_count / len(records)
            }
            logging.info(f"获取到用户历史表现 - 最近{len(records)}次练习，正确率: {performance['correct_rate']:.2%}")
        else:
            logging.info("未找到该类别的历史记录")
        
        # 从system_vocabulary表中随机获取一个单词
        sql = text("""
            SELECT word, reading, meaning, example, example_reading, example_meaning, category
            FROM system_vocabulary
            WHERE category = :category
            ORDER BY RANDOM()
            LIMIT 1
        """)
        
        result = db.session.execute(sql, {'category': category}).first()
        
        if not result:
            return jsonify({'error': 'No words available for this category'}), 404
            
        # 获取其他三个错误选项
        wrong_options_sql = text("""
            SELECT meaning 
            FROM system_vocabulary 
            WHERE category = :category 
                AND word != :word 
                AND meaning != :meaning
            ORDER BY RANDOM() 
            LIMIT 3
        """)
        
        wrong_options = [row[0] for row in db.session.execute(
            wrong_options_sql,
            {
                'category': category, 
                'word': result.word,
                'meaning': result.meaning
            }
        ).fetchall()]
        
        # 如果获取的错误选项不足3个，从其他类别补充
        if len(wrong_options) < 3:
            additional_options_sql = text("""
                SELECT meaning 
                FROM system_vocabulary 
                WHERE meaning != :meaning
                    AND word != :word
                ORDER BY RANDOM() 
                LIMIT :limit
            """)
            
            additional_options = [row[0] for row in db.session.execute(
                additional_options_sql,
                {
                    'meaning': result.meaning,
                    'word': result.word,
                    'limit': 3 - len(wrong_options)
                }
            ).fetchall()]
            
            wrong_options.extend(additional_options)
        
        # 构建选项列表并随机打乱
        options = [result.meaning] + wrong_options
        random.shuffle(options)
        
        word_data = {
            'word': result.word,
            'reading': result.reading,
            'meaning': result.meaning,
            'options': options,
            'example': result.example,
            'example_reading': result.example_reading,
            'example_meaning': result.example_meaning
        }
        
        end_time = time.time()
        logging.info(f"=== 单词获取完成 耗时: {end_time - start_time:.2f}秒 ===")
        return jsonify(word_data)
            
    except Exception as e:
        logging.error(f"处理请求时出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

@vocabulary_bp.route('/api/vocabulary/record', methods=['POST'])
def record_answer():
    logging.info("开始记录答案")
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
            
        user_id = data.get('user_id')
        word = data.get('word')
        category = data.get('category')
        is_correct = data.get('is_correct')
        
        if not all([user_id, word, category, isinstance(is_correct, bool)]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        logging.info(f"答案数据 - 用户: {user_id}, 单词: {word}, 类别: {category}, 正确: {is_correct}")
        
        record = VocabularyRecord(
            user_id=user_id,
            word=word,
            category=category,
            is_correct=is_correct
        )
        
        db.session.add(record)
        db.session.commit()
        
        logging.info("成功保存答案记录")
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.error(f"保存答案记录时出错: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@vocabulary_bp.route('/api/vocabulary/stats', methods=['GET'])
def get_stats():
    logging.info("开始获取统计数据")
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
            
        logging.info(f"获取用户 {user_id} 的统计数据")
        
        # 获取总体统计
        total_words = VocabularyRecord.query.filter_by(user_id=user_id).count()
        correct_words = VocabularyRecord.query.filter_by(
            user_id=user_id,
            is_correct=True
        ).count()
        
        # 按类别统计
        category_stats = {}
        for category in CATEGORIES.keys():
            total = VocabularyRecord.query.filter_by(
                user_id=user_id,
                category=category
            ).count()
            correct = VocabularyRecord.query.filter_by(
                user_id=user_id,
                category=category,
                is_correct=True
            ).count()
            
            category_stats[category] = {
                'total': total,
                'correct': correct,
                'accuracy': correct / total if total > 0 else 0
            }
        
        stats = {
            'total_words': total_words,
            'correct_words': correct_words,
            'accuracy': correct_words / total_words if total_words > 0 else 0,
            'category_stats': category_stats
        }
        
        logging.info(f"统计数据: {stats}")
        return jsonify(stats)
    except Exception as e:
        logging.error(f"获取统计数据时出错: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@vocabulary_bp.route('/api/vocabulary/favorite', methods=['POST'])
def add_to_favorites():
    """添加单词到单词本"""
    logging.info("开始添加单词到单词本")
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
            
        user_id = data.get('user_id')
        word = data.get('word')
        reading = data.get('reading')
        meaning = data.get('meaning')
        example = data.get('example')
        example_reading = data.get('example_reading')
        example_meaning = data.get('example_meaning')
        category = data.get('category')
        
        if not all([user_id, word, reading, meaning, category]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # 检查是否已经存在
        existing = Vocabulary.query.filter_by(
            user_id=user_id,
            word=word
        ).first()
        
        if existing:
            return jsonify({'status': 'already exists'}), 200
        
        vocabulary = Vocabulary(
            user_id=user_id,
            word=word,
            reading=reading,
            meaning=meaning,
            example=example,
            example_reading=example_reading,
            example_meaning=example_meaning,
            category=category
        )
        
        db.session.add(vocabulary)
        db.session.commit()
        
        logging.info(f"成功添加单词到单词本: {word}")
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.error(f"添加单词到单词本时出错: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@vocabulary_bp.route('/api/vocabulary/favorite', methods=['DELETE'])
def remove_from_favorites():
    """从单词本中删除单词"""
    logging.info("开始从单词本中删除单词")
    try:
        word = request.args.get('word')
        user_id = request.args.get('user_id')
        
        if not all([word, user_id]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        vocabulary = Vocabulary.query.filter_by(
            word=word,
            user_id=user_id
        ).first()
        
        if not vocabulary:
            return jsonify({'error': 'Word not found'}), 404
        
        db.session.delete(vocabulary)
        db.session.commit()
        
        logging.info(f"成功从单词本中删除单词: {vocabulary.word}")
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.error(f"从单词本中删除单词时出错: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@vocabulary_bp.route('/api/vocabulary/favorites', methods=['GET'])
def get_favorites():
    """获取用户的单词本"""
    logging.info("开始获取单词本")
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        favorites = Vocabulary.query.filter_by(
            user_id=user_id
        ).order_by(Vocabulary.created_at.desc()).all()
        
        result = [word.serialize for word in favorites]
        
        logging.info(f"成功获取单词本，共 {len(result)} 个单词")
        return jsonify(result)
    except Exception as e:
        logging.error(f"获取单词本时出错: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@vocabulary_bp.route('/api/vocabulary/history', methods=['GET'])
def get_history():
    """获取用户的学习历史"""
    logging.info("开始获取学习历史")
    try:
        user_id = request.args.get('user_id')
        limit = request.args.get('limit', 20, type=int)
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        # 获取历史记录，并关联单词本中的意思
        records = db.session.query(
            VocabularyRecord,
            Vocabulary.meaning
        ).outerjoin(
            Vocabulary,
            db.and_(
                VocabularyRecord.word == Vocabulary.word,
                VocabularyRecord.user_id == Vocabulary.user_id
            )
        ).filter(
            VocabularyRecord.user_id == user_id
        ).order_by(
            VocabularyRecord.created_at.desc()
        ).limit(limit).all()
        
        result = [{
            'word': record.VocabularyRecord.word,
            'category': record.VocabularyRecord.category,
            'is_correct': record.VocabularyRecord.is_correct,
            'meaning': record.meaning,
            'created_at': record.VocabularyRecord.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for record in records]
        
        logging.info(f"成功获取学习历史，共 {len(result)} 条记录")
        return jsonify(result)
    except Exception as e:
        logging.error(f"获取学习历史时出错: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500 