import os
import base64
from io import BytesIO
from flask import Blueprint, render_template, request, jsonify, current_app, session, flash, redirect, url_for
from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed
from wtforms import StringField, DateField, SelectField, TextAreaField
from models import db, User
from PIL import Image
from datetime import datetime
from functools import wraps

profile_bp = Blueprint('profile', __name__)

class ProfileForm(FlaskForm):
    """个人资料表单"""
    avatar = FileField('画像', validators=[FileAllowed(['jpg', 'jpeg', 'png'], '画像ファイルのみ許可されています。')])
    birthday = DateField('誕生日', format='%Y-%m-%d', validators=[])
    zodiac_sign = SelectField('星座', choices=[
        ('', '選択してください'),
        ('牡羊座', '牡羊座'), ('牡牛座', '牡牛座'), ('双子座', '双子座'),
        ('蟹座', '蟹座'), ('獅子座', '獅子座'), ('乙女座', '乙女座'),
        ('天秤座', '天秤座'), ('蠍座', '蠍座'), ('射手座', '射手座'),
        ('山羊座', '山羊座'), ('水瓶座', '水瓶座'), ('魚座', '魚座')
    ])
    mbti = StringField('MBTI')
    bio = TextAreaField('自己紹介')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def process_avatar(file):
    """处理头像图片并返回 Base64 编码"""
    try:
        # 打开并处理图片
        img = Image.open(file)
        
        # 如果图片是RGBA模式（PNG格式），转换为RGB
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # 调整图片大小为200x200，保持纵横比
        img.thumbnail((200, 200), Image.Resampling.LANCZOS)
        
        # 创建一个200x200的白色背景
        output = Image.new('RGB', (200, 200), (255, 255, 255))
        
        # 将调整后的图片粘贴到中心位置
        offset = ((200 - img.size[0]) // 2, (200 - img.size[1]) // 2)
        output.paste(img, offset)
        
        # 将图片转换为 Base64
        buffered = BytesIO()
        output.save(buffered, format="JPEG", quality=85, optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return f"data:image/jpeg;base64,{img_str}"
    except Exception as e:
        current_app.logger.error(f"头像处理错误: {str(e)}")
        return None

@profile_bp.route('/profile')
@login_required
def profile():
    """显示用户资料页面"""
    try:
        user = User.query.get(session['user_id'])
        if not user:
            flash('ユーザーが見つかりません。', 'error')
            return redirect(url_for('login'))
        return render_template('profile.html', user=user, active_tab='profile')
    except Exception as e:
        current_app.logger.error(f"获取用户资料错误: {str(e)}")
        flash('プロフィールの読み込みに失敗しました。', 'error')
        return redirect(url_for('index'))

@profile_bp.route('/api/profile', methods=['POST'])
@login_required
def update_profile():
    """更新用户资料"""
    try:
        current_app.logger.info("开始处理用户资料更新请求")
        user = User.query.get(session['user_id'])
        if not user:
            current_app.logger.error("找不到用户")
            return jsonify({'success': False, 'error': 'ユーザーが見つかりません。'}), 404
            
        current_app.logger.info(f"当前用户: {user.username}")
        
        # 记录请求数据
        current_app.logger.info(f"表单数据: {request.form.to_dict()}")
        current_app.logger.info(f"文件数据: {request.files}")
        
        # 处理头像上传
        if 'avatar' in request.files:
            file = request.files['avatar']
            if file and file.filename:
                try:
                    current_app.logger.info("开始处理头像图片")
                    avatar_data = process_avatar(file)
                    if avatar_data:
                        current_app.logger.info("头像处理成功，准备保存")
                        user.avatar_data = avatar_data
                    else:
                        current_app.logger.error("头像处理失败")
                        return jsonify({'success': False, 'error': '画像の処理に失敗しました。'}), 500
                except Exception as e:
                    current_app.logger.error(f"头像处理异常: {str(e)}")
                    return jsonify({'success': False, 'error': '画像のアップロードに失敗しました。'}), 500
        
        # 更新其他资料
        if 'birthday' in request.form and request.form['birthday']:
            try:
                user.birthday = datetime.strptime(request.form['birthday'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'success': False, 'error': '誕生日の形式が正しくありません。'}), 400
        else:
            user.birthday = None
            
        user.zodiac_sign = request.form.get('zodiac_sign') or None
        user.mbti = request.form.get('mbti', '').upper() if request.form.get('mbti') else None
        user.bio = request.form.get('bio') or None
        
        try:
            current_app.logger.info("准备保存更改到数据库")
            db.session.commit()
            current_app.logger.info("数据库更新成功")
            
            response_data = {
                'success': True,
                'avatar_data': user.avatar_data,
                'user': {
                    'username': user.username,
                    'birthday': user.birthday.strftime('%Y-%m-%d') if user.birthday else None,
                    'zodiac_sign': user.zodiac_sign,
                    'mbti': user.mbti,
                    'bio': user.bio
                }
            }
            current_app.logger.info("准备返回响应")
            return jsonify(response_data)
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"数据库保存失败: {str(e)}")
            return jsonify({'success': False, 'error': 'プロフィールの保存に失敗しました。'}), 500
            
    except Exception as e:
        current_app.logger.error(f"更新资料过程中发生异常: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@profile_bp.route('/api/user/<int:user_id>')
@login_required
def get_user_info(user_id):
    """获取指定用户的公开信息"""
    try:
        user = User.query.get_or_404(user_id)
        return jsonify({
            'success': True,
            'user': {
                'username': user.username,
                'zodiac_sign': user.zodiac_sign,
                'mbti': user.mbti,
                'bio': user.bio,
                'avatar_data': user.avatar_data,
                'streak_days': user.streak_days,
                'total_practices': user.total_practices,
                'avg_reading_score': user.avg_reading_score,
                'avg_topic_score': user.avg_topic_score
            }
        })
    except Exception as e:
        current_app.logger.error(f"获取用户信息错误: {str(e)}")
        return jsonify({'success': False, 'error': 'ユーザー情報の取得に失敗しました。'}), 500 