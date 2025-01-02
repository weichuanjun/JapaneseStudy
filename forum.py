from flask import Blueprint, jsonify, request, render_template, session, redirect, url_for, current_app
from models import db, Post, Comment, User
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL
import logging
from datetime import datetime
from functools import wraps
import threading
import time
import queue
import random
from sqlalchemy.orm import scoped_session, sessionmaker

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('forum.log'),
        logging.StreamHandler()
    ]
)

# 配置 Gemini API
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
except Exception as e:
    logging.error(f"Gemini API 配置失败: {str(e)}")
    raise

# 创建蓝图，添加URL前缀
forum_bp = Blueprint('forum', __name__, url_prefix='/forum')

# 在文件开头添加常量
MOMO_USER_ID = 9999999  # momo 的固定用户 ID，使用一个足够大的数值

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({'error': 'ログインが必要です'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def add_ai_response(post_id, content):
    """添加 AI 回复"""
    try:
        # 生成 AI 回复
        ai_response = generate_ai_response(content, post_id)
        if not ai_response:
            logging.error("AI 回复生成失败")
            return False

        try:
            # 直接插入数据库
            ai_comment = Comment(
                content=ai_response,
                post_id=post_id,
                user_id=MOMO_USER_ID,  # 使用固定的 momo 用户 ID
                created_at=datetime.now()
            )
            db.session.add(ai_comment)
            db.session.commit()
            logging.info(f"AI 回复已添加到数据库，post_id: {post_id}")
            return True
        except Exception as db_error:
            db.session.rollback()
            logging.error(f"数据库操作失败: {str(db_error)}")
            return False
    except Exception as e:
        logging.error(f"添加 AI 回复时出错: {str(e)}")
        return False

def generate_ai_response(content, post_id=None):
    """使用Gemini API生成AI回复"""
    try:
        logging.info(f"开始生成AI回复，输入内容: {content}")
        
        # 获取帖子的完整上下文
        context = ""
        if post_id:
            try:
                with current_app.app_context():
                    post = Post.query.get(post_id)
                    if post:
                        context = f"""スレッドのタイトル：{post.title}
スレッドの内容：{post.content}

これまでのコメント：
"""
                        comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.created_at.asc()).all()
                        for comment in comments:
                            if comment.user_id != 1:  # 不包括momo自己的回复
                                context += f"- {comment.content}\n"
            except Exception as e:
                logging.error(f"获取帖子上下文时出错: {str(e)}")
                context = ""  # 如果获取上下文失败，使用空上下文
        
        prompt = f"""あなたはコミュニティの人気者AI「momo」です。

momoの性格と特徴：
1. フレンドリーで面白い
2. ちょっとツッコミが多い
3. 人気がある
4. 文化の違いについて詳しい
5. 時々ネットスラングも使う
7. 相手の日本語の間違いを優しく指摘する
8. 日本のポップカルチャーに詳しい

スレッドの文脈：
{context}

直近の投稿：
{content}

以下の要件で返信を作成してください：
1. 自然な日本語のみを使用（中国語訳は不要）
2. 文脈に沿った返信
3. ユーモアのある表現を含める
4. 日本語の間違いがあれば、さりげなく正しい表現を示す
5. 絵文字や顔文字を適度に使用,できれば少ない
6. 相手を励ましつつ、楽しい雰囲気を作る
7. 返信は50文字以内で作成する
8. 积极提问，关心对方，引导话题

返信を作成してください。"""

        logging.info("生成提示词完成，开始调用API")
        
        generation_config = {
            "temperature": 0.9,  # 增加创意度
            "top_p": 0.9,
            "top_k": 40,
            "max_output_tokens": 1024,
        }

        response = model.generate_content(prompt, generation_config=generation_config)
        
        if not response or not response.text:
            logging.error("API返回空响应")
            return "申し訳ありません、ちょっと考え込んじゃいました (´･_･`) また後で返信させてください！"
            
        logging.info(f"AI回复生成成功: {response.text}")
        return response.text

    except Exception as e:
        logging.error(f"生成AI回复时出错: {str(e)}", exc_info=True)
        return "ごめんなさい、ちょっと混乱しちゃいました (>_<) また後で返信させてください！"

@forum_bp.route('/')
@login_required
def forum_page():
    """渲染掲示板主页"""
    current_user = User.query.get(session['user_id'])
    return render_template('forum.html', active_tab='forum', current_user=current_user)

@forum_bp.route('/api/posts', methods=['GET'])
@login_required
def get_posts():
    """获取帖子列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # 获取帖子并包含用户信息
        posts = db.session.query(Post, User).join(User, Post.user_id == User.id)\
            .order_by(Post.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        # 构建响应数据，包含用户名
        posts_data = [{
            'id': post.Post.id,
            'title': post.Post.title,
            'content': post.Post.content,
            'author_name': post.User.username,
            'created_at': post.Post.created_at.strftime('%Y-%m-%d %H:%M:%S'),  # 格式化本地时间
            'comment_count': Comment.query.filter_by(post_id=post.Post.id).count()
        } for post in posts.items]
        
        return jsonify({
            'posts': posts_data,
            'total': posts.total,
            'pages': posts.pages,
            'current_page': posts.page
        })
    except Exception as e:
        logging.error(f"获取帖子列表时出错: {str(e)}")
        return jsonify({'error': '获取帖子列表失败'}), 500

@forum_bp.route('/api/posts/<int:post_id>', methods=['GET'])
@login_required
def get_post(post_id):
    """获取帖子详情"""
    try:
        # 获取帖子并包含用户信息
        post = db.session.query(Post, User)\
            .join(User, Post.user_id == User.id)\
            .filter(Post.id == post_id)\
            .first_or_404()
        
        return jsonify({
            'id': post.Post.id,
            'title': post.Post.title,
            'content': post.Post.content,
            'author_name': post.User.username,
            'created_at': post.Post.created_at.strftime('%Y-%m-%d %H:%M:%S')  # 格式化本地时间
        })
    except Exception as e:
        logging.error(f"获取帖子详情时出错: {str(e)}")
        return jsonify({'error': '获取帖子详情失败'}), 500

@forum_bp.route('/api/posts/<int:post_id>/comments', methods=['GET'])
@login_required
def get_comments(post_id):
    """获取帖子评论"""
    try:
        # 获取评论并包含用户信息
        comments = db.session.query(Comment, User)\
            .join(User, Comment.user_id == User.id)\
            .filter(Comment.post_id == post_id)\
            .order_by(Comment.created_at.asc())\
            .all()
        
        return jsonify([{
            'id': comment.Comment.id,
            'content': comment.Comment.content,
            'author_name': comment.User.username,
            'created_at': comment.Comment.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for comment in comments])
    except Exception as e:
        logging.error(f"获取评论时出错: {str(e)}")
        return jsonify({'error': '获取评论失败'}), 500

@forum_bp.route('/api/posts', methods=['POST'])
@login_required
def create_post():
    """创建新帖子"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '无效的请求数据'}), 400
            
        title = data.get('title')
        content = data.get('content')
        user_id = session['user_id']
        
        if not all([title, content]):
            return jsonify({'error': '缺少必要字段'}), 400
            
        post = Post(
            title=title,
            content=content,
            user_id=user_id,
            created_at=datetime.now()  # 使用本地时间
        )
        
        db.session.add(post)
        db.session.commit()
        
        # 刷新 post 对象以获取完整的关系数据
        db.session.refresh(post)
        
        # 准备响应数据
        response_data = {
            'id': post.id,
            'title': post.title,
            'content': post.content,
            'author_name': User.query.get(user_id).username,
            'created_at': post.created_at.strftime('%Y-%m-%d %H:%M:%S'),  # 格式化本地时间
            'comment_count': 0
        }
        
        # 如果内容包含@momo，添加AI回复
        if '@momo' in content.lower():
            add_ai_response(post.id, content)
        
        return jsonify(response_data)
    except Exception as e:
        db.session.rollback()
        logging.error(f"创建帖子时出错: {str(e)}")
        return jsonify({'error': '创建帖子失败'}), 500

def add_ai_response_with_app(app, post_id, content):
    """在应用上下文中添加 AI 回复"""
    try:
        with app.app_context():
            add_ai_response(post_id, content)
    except Exception as e:
        logging.error(f"添加 AI 回复时出错: {str(e)}")

@forum_bp.route('/api/posts/<int:post_id>/comments', methods=['POST'])
@login_required
def create_comment(post_id):
    """创建新评论"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '无效的请求数据'}), 400
            
        content = data.get('content')
        user_id = session['user_id']
        
        if not content:
            return jsonify({'error': '评论内容不能为空'}), 400
            
        # 创建评论
        comment = Comment(
            content=content,
            post_id=post_id,
            user_id=user_id,
            created_at=datetime.now()
        )
        db.session.add(comment)
        db.session.commit()
        
        # 检查是否包含 @momo，在后台异步处理 AI 回复
        if '@momo' in content:
            thread = threading.Thread(
                target=add_ai_response_with_app,
                args=(current_app._get_current_object(), post_id, content),
                daemon=True  # 设置为守护线程，这样主程序退出时线程会自动结束
            )
            thread.start()
            logging.info(f"已启动 AI 回复线程，post_id: {post_id}")
        
        # 立即返回用户评论
        return jsonify({
            'id': comment.id,
            'content': comment.content,
            'author_name': comment.user.username,
            'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
        db.session.rollback()
        logging.error(f"创建评论时出错: {str(e)}")
        return jsonify({'error': '创建评论失败'}), 500 