from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from datetime import datetime
import pytz

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Asia/Tokyo')))
    study_records = db.relationship('StudyRecord', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class StudyRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    activity_type = db.Column(db.String(20), nullable=False)  # 'reading' or 'topic'
    content = db.Column(db.Text)
    user_input = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Asia/Tokyo')))
    
    # Reading scores
    accuracy_score = db.Column(db.Float)
    fluency_score = db.Column(db.Float)
    completeness_score = db.Column(db.Float)
    pronunciation_score = db.Column(db.Float)
    
    # Topic scores
    grammar_score = db.Column(db.Float)
    content_score = db.Column(db.Float)
    relevance_score = db.Column(db.Float)
    feedback = db.Column(db.Text)

    @property
    def average_score(self):
        if self.activity_type == 'reading':
            scores = [self.accuracy_score, self.fluency_score, 
                     self.completeness_score, self.pronunciation_score]
            valid_scores = [s for s in scores if s is not None]
            return sum(valid_scores) / len(valid_scores) if valid_scores else 0
        elif self.activity_type == 'topic':
            scores = [self.grammar_score, self.content_score, self.relevance_score]
            valid_scores = [s for s in scores if s is not None]
            return sum(valid_scores) / len(valid_scores) if valid_scores else 0
        return 0 