import google.generativeai as genai
from datetime import datetime
from app.models import db, ReadingRecord, TopicRecord
from app.config import GEMINI_API_KEY, GEMINI_MODEL
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)

# 配置Gemini
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
except Exception as e:
    logging.error(f"Gemini API配置失败: {str(e)}")

def get_greeting(username):
    """根据时间返回适当的问候语"""
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return f"おはようございます、{username}さん"
    elif 12 <= hour < 18:
        return f"こんにちは、{username}さん"
    else:
        return f"こんばんは、{username}さん"

def get_learning_advice(user_id):
    """获取用户的学习记录并生成建议"""
    try:
        # 获取最近的学习记录，使用正确的查询方式
        reading_records = db.session.query(ReadingRecord)\
            .filter(ReadingRecord.user_id == user_id)\
            .order_by(ReadingRecord.practice_date.desc())\
            .limit(5).all()
            
        topic_records = db.session.query(TopicRecord)\
            .filter(TopicRecord.user_id == user_id)\
            .order_by(TopicRecord.practice_date.desc())\
            .limit(5).all()
        
        if not reading_records and not topic_records:
            return "まだ学習記録がありません。新しい練習を始めましょう！"
        
        # 设置生成参数
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048
        }
        
        # 构建提示信息
        prompt = """以下の学習記録に基づいて、分析と学習計画を作成してください。

# 1. 強みと弱点

**強み:**
• 箇条書きで記載

**弱点:**
• 箇条書きで記載

# 2. 具体的な改善アドバイス

**読解力の向上:**
• 具体的なアドバイスを箇条書きで記載

**会話力の向上:**
• 具体的なアドバイスを箇条書きで記載

# 3. 次週の学習計画

**毎日の学習:**
• 具体的な学習項目と時間を記載

**週末の学習:**
• 具体的な学習項目と時間を記載

以下が最近の学習記録です：

"""
        
        # 添加阅读记录
        if reading_records:
            prompt += "【読解練習】\n"
            for record in reading_records:
                prompt += f"• 日付: {record.practice_date.strftime('%Y-%m-%d')} - 正確性: {record.accuracy_score}%, 流暢さ: {record.fluency_score}%, "
                prompt += f"完全性: {record.completeness_score}%, 発音: {record.pronunciation_score}%\n"
        
        # 添加会话记录
        if topic_records:
            prompt += "\n【会話練習】\n"
            for record in topic_records:
                prompt += f"• 日付: {record.practice_date.strftime('%Y-%m-%d')} - トピック: {record.topic}\n"
                prompt += f"  文法: {record.grammar_score}%, 内容: {record.content_score}%, 関連性: {record.relevance_score}%\n"
        
        prompt += """
これらの記録を分析し、以下の点に注意して回答を作成してください：
1. 学習者の強みと弱みを具体的に分析
2. 改善のための具体的なアドバイスを提供
3. 実践的で実行可能な次週の学習計画を提案

回答は必ずMarkdown形式で、見やすく整理された形で提供してください。
箇条書きの間に余分な改行を入れないでください。
各セクション間は1行の改行のみとしてください。"""
        
        logging.info("正在调用Gemini API生成建议...")
        logging.debug(f"提示词内容: {prompt}")
        
        # 调用API
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        if not response or not response.text:
            logging.error("Gemini API返回空响应")
            return "申し訳ありません。アドバイスの生成に失敗しました。しばらくしてからもう一度お試しください。"
            
        return response.text.strip()
        
    except Exception as e:
        logging.error(f"生成学习建议时出错: {str(e)}")
        return f"申し訳ありません。アドバイスの生成中にエラーが発生しました：{str(e)}" 