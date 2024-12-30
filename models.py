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
    
    # 关联练习记录
    reading_records = db.relationship('ReadingRecord', backref='user', lazy=True)
    topic_records = db.relationship('TopicRecord', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

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