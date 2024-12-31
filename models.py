from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=datetime.now)
    last_practice = db.Column(db.DateTime)
    streak_days = db.Column(db.Integer, default=0)
    
    # 关联练习记录
    reading_records = db.relationship('ReadingRecord', backref='user', lazy=True)
    topic_records = db.relationship('TopicRecord', backref='user', lazy=True)
    vocabulary_records = db.relationship('VocabularyRecord', backref='user', lazy=True)

    @property
    def avg_reading_score(self):
        """计算阅读练习的平均分"""
        from sqlalchemy import func
        result = db.session.query(
            func.avg(
                (ReadingRecord.accuracy_score + 
                 ReadingRecord.fluency_score + 
                 ReadingRecord.completeness_score + 
                 ReadingRecord.pronunciation_score) / 4
            )
        ).filter(ReadingRecord.user_id == self.id).scalar()
        return round(float(result or 0), 1)

    @property
    def avg_topic_score(self):
        """计算Topic练习的平均分"""
        from sqlalchemy import func
        result = db.session.query(
            func.avg(
                (TopicRecord.grammar_score + 
                 TopicRecord.content_score + 
                 TopicRecord.relevance_score) / 3
            )
        ).filter(TopicRecord.user_id == self.id).scalar()
        return round(float(result or 0), 1)

    @property
    def vocabulary_stats(self):
        """获取词汇学习统计"""
        from sqlalchemy import func
        total = db.session.query(func.count(VocabularyRecord.id)).filter(
            VocabularyRecord.user_id == self.id
        ).scalar()
        
        correct = db.session.query(func.count(VocabularyRecord.id)).filter(
            VocabularyRecord.user_id == self.id,
            VocabularyRecord.is_correct == True
        ).scalar()
        
        return {
            'total': total or 0,
            'correct': correct or 0,
            'accuracy': round(correct / total if total > 0 else 0, 2)
        }

    @property
    def total_practices(self):
        return len(self.reading_records) + len(self.topic_records) + len(self.vocabulary_records)

    @property
    def total_study_time(self):
        # 假设每次练习平均5分钟，词汇练习1分钟
        return (len(self.reading_records) + len(self.topic_records)) * 5 + len(self.vocabulary_records)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def update_streak(self):
        from datetime import timedelta
        now = datetime.now()
        
        if not self.last_practice:
            self.streak_days = 1
        else:
            days_diff = (now.date() - self.last_practice.date()).days
            if days_diff == 0:  # 同一天的练习
                pass
            elif days_diff == 1:  # 连续天数
                self.streak_days += 1
            else:  # 中断了
                self.streak_days = 1
                
        self.last_practice = now

class ReadingRecord(db.Model):
    __tablename__ = 'reading_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    practice_date = db.Column(db.DateTime, default=datetime.now)
    content = db.Column(db.Text, nullable=False)  # 练习的文本内容
    accuracy_score = db.Column(db.Float)
    fluency_score = db.Column(db.Float)
    completeness_score = db.Column(db.Float)
    pronunciation_score = db.Column(db.Float)
    words_omitted = db.Column(db.Text)
    words_inserted = db.Column(db.Text)

class TopicRecord(db.Model):
    __tablename__ = 'topic_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    practice_date = db.Column(db.DateTime, default=datetime.now)
    topic = db.Column(db.Text, nullable=False)  # 话题内容
    response = db.Column(db.Text, nullable=False)  # 用户的回答
    grammar_score = db.Column(db.Integer)
    content_score = db.Column(db.Integer)
    relevance_score = db.Column(db.Integer)
    feedback = db.Column(db.Text)
    grammar_correction = db.Column(db.Text)

class VocabularyRecord(db.Model):
    __tablename__ = 'vocabulary_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    word = db.Column(db.String(100), nullable=False)  # 日语单词
    category = db.Column(db.String(20), nullable=False)  # 单词类别（N1-N5, daily, business）
    is_correct = db.Column(db.Boolean, nullable=False)  # 回答是否正确
    created_at = db.Column(db.DateTime, default=datetime.now)

    @classmethod
    def get_user_performance(cls, user_id, category, limit=10):
        """获取用户在特定类别的最近表现"""
        records = cls.query.filter_by(
            user_id=user_id,
            category=category
        ).order_by(cls.created_at.desc()).limit(limit).all()
        
        if not records:
            return None
            
        correct_count = sum(1 for r in records if r.is_correct)
        return {
            'correct_rate': correct_count / len(records),
            'total_answered': len(records)
        } 