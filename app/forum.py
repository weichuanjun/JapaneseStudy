from flask import Blueprint, jsonify, request, render_template, session, redirect, url_for, current_app
from app.models import db, Post, Comment, User, Tag, AIMemory, AIRelationship, AIPersonality, AIInteraction, AffinityHistory
import google.generativeai as genai
from app.config import GEMINI_API_KEY, GEMINI_MODEL
import logging
from datetime import datetime
from functools import wraps
import threading
import time
import queue
import random
from sqlalchemy.orm import scoped_session, sessionmaker
import os
import sys

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),  # 使用标准输出流
    ]
)

# 创建一个专门的日志记录器
logger = logging.getLogger('forum')
logger.setLevel(logging.INFO)

def log_debug(msg):
    """记录调试信息"""
    logger.debug(msg)
    print(f"[DEBUG] {msg}")

def log_info(msg):
    """记录普通信息"""
    logger.info(msg)
    print(f"[INFO] {msg}")

def log_error(msg):
    """记录错误信息"""
    logger.error(msg)
    print(f"[ERROR] {msg}")

# 配置 Gemini API
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
except Exception as e:
    logging.error(f"Gemini API 配置失败: {str(e)}")
    raise RuntimeError("Gemini API 配置失败") from e

# 创建蓝图，添加URL前缀
forum_bp = Blueprint('forum', __name__, url_prefix='/forum')

# 在文件开头添加常量
MOMO_USER_ID = 9999999  # momo 的固定用户 ID，使用一个足够大的数值

class ForumError(Exception):
    """论坛模块的基础异常类"""
    pass

class AIResponseError(ForumError):
    """AI 回复生成相关的异常"""
    pass

class DatabaseError(ForumError):
    """数据库操作相关的异常"""
    pass

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({'error': 'ログインが必要です'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def add_ai_response(post_id, content, user_id=None):
    """添加 AI 回复"""
    try:
        log_info(f"开始添加AI回复，post_id: {post_id}, user_id: {user_id}")
        
        # 生成 AI 回复
        try:
            ai_response = generate_ai_response(content, post_id, user_id)
        except (AIResponseError, DatabaseError) as e:
            log_error(f"AI 回复生成失败: {str(e)}")
            return False

        try:
            # 创建评论
            ai_comment = Comment(
                content=ai_response,
                post_id=post_id,
                user_id=MOMO_USER_ID,
                created_at=datetime.now()
            )
            db.session.add(ai_comment)
            log_info(f"AI评论已创建: {ai_comment.content[:100]}...")
            
            # 记录互动
            if user_id:
                log_info(f"开始处理用户 {user_id} 的互动记录")
                
                # 分析情感
                sentiment_score = analyze_sentiment(content)
                log_info(f"情感分析得分: {sentiment_score}")
                
                # 记录互动历史
                interaction = AIInteraction(
                    user_id=user_id,
                    content=content,
                    response=ai_response,
                    sentiment_score=sentiment_score,
                    interaction_type='forum_reply'
                )
                db.session.add(interaction)
                log_info(f"已创建互动记录")

                # 记录记忆
                memory = AIMemory(
                    user_id=user_id,
                    post_id=post_id,
                    interaction_content=content,
                    ai_response=ai_response,
                    sentiment_score=sentiment_score
                )
                db.session.add(memory)
                log_info(f"已创建记忆记录")
                
                # 更新关系
                relationship = get_or_create_relationship(user_id)
                old_score = relationship.affinity_score
                log_info(f"当前亲密度: {old_score}")
                
                relationship.adjust_affinity(sentiment_score)
                relationship.interaction_count += 1
                relationship.last_interaction_at = datetime.now()
                
                log_info(f"亲密度更新: {old_score} -> {relationship.affinity_score}")
                log_info(f"互动次数: {relationship.interaction_count}")
                log_info(f"最后互动时间: {relationship.last_interaction_at}")
                
                # 记录好感度变化
                if old_score != relationship.affinity_score:
                    affinity_change = AffinityHistory(
                        user_id=user_id,
                        old_score=old_score,
                        new_score=relationship.affinity_score,
                        change_reason=f'论坛回复 - 情感分数: {sentiment_score}'
                    )
                    db.session.add(affinity_change)
                    log_info(f"已记录亲密度变化历史: {old_score} -> {relationship.affinity_score}")
            
            db.session.commit()
            log_info("所有数据库更新已提交")
            return True
            
        except Exception as db_error:
            db.session.rollback()
            log_error(f"数据库操作失败: {str(db_error)}")
            raise DatabaseError("保存AI回复失败") from db_error
            
    except Exception as e:
        log_error(f"添加 AI 回复时出错: {str(e)}")
        if isinstance(e, (AIResponseError, DatabaseError)):
            raise
        raise RuntimeError("添加AI回复时发生未知错误") from e

def get_user_interaction_history(user_id):
    """获取用户与 AI 的互动历史"""
    try:
        memories = AIMemory.query.filter_by(user_id=user_id).order_by(AIMemory.created_at.desc()).limit(5).all()
        history = []
        for memory in memories:
            history.append({
                'user_content': memory.interaction_content,
                'ai_response': memory.ai_response,
                'created_at': memory.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        return history
    except Exception as e:
        logging.error(f"获取用户互动历史时出错: {str(e)}")
        raise DatabaseError("获取用户互动历史失败") from e

def get_or_create_relationship(user_id):
    """获取或创建用户与 AI 的关系记录"""
    try:
        relationship = AIRelationship.query.filter_by(user_id=user_id).first()
        if relationship:
            log_info(f"找到现有关系记录 - 用户ID: {user_id}, 亲密度: {relationship.affinity_score}, 互动次数: {relationship.interaction_count}")
        else:
            log_info(f"为用户 {user_id} 创建新的关系记录")
            relationship = AIRelationship(
                user_id=user_id,
                affinity_score=50.0,
                interaction_count=0,
                last_interaction_at=datetime.now()
            )
            db.session.add(relationship)
            db.session.commit()
            log_info(f"新关系记录创建成功 - 初始亲密度: {relationship.affinity_score}")
        return relationship
    except Exception as e:
        log_error(f"获取或创建用户关系时出错: {str(e)}")
        db.session.rollback()
        raise DatabaseError("获取或创建用户关系失败") from e

def analyze_sentiment(text):
    """分析文本情感倾向"""
    try:
        log_info(f"开始情感分析，文本: {text[:100]}...")
        prompt = f"""以下の文章の感情分析を行い、-1から1の間のスコアで評価してください。
ポジティブな感情は正の値、ネガティブな感情は負の値、中立は0とします。
返答は数値のみにしてください。

文章：{text}"""
        
        response = model.generate_content(prompt)
        if response and response.text:
            try:
                sentiment_score = float(response.text.strip())
                sentiment_score = max(-1, min(1, sentiment_score))  # 确保值在 -1 到 1 之间
                log_info(f"情感分析完成，分数: {sentiment_score}")
                return sentiment_score
            except ValueError:
                log_warning("无法解析情感分数，使用默认值0")
                return 0
    except Exception as e:
        log_error(f"感情分析出错: {str(e)}")
        raise AIResponseError("感情分析失败") from e

def generate_ai_response(content, post_id=None, user_id=None):
    """使用 Gemini API 生成 AI 回复"""
    try:
        log_info(f"开始生成AI回复，输入内容: {content}, post_id: {post_id}, user_id: {user_id}")
        
        # 获取 AI 人格设定
        ai_personality = AIPersonality.query.first()
        if not ai_personality:
            try:
                from app.ai_personality_init import init_ai_personality
                init_ai_personality()
                ai_personality = AIPersonality.query.first()
                if not ai_personality:
                    raise AIResponseError("AI人格初始化失败")
            except Exception as e:
                log_error(f"初始化AI人格时出错: {str(e)}")
                raise AIResponseError("AI人格初始化失败") from e
        
        log_info("成功获取AI人格设定")
        log_info(f"AI人格信息:\n角色: {ai_personality.role}\n背景: {ai_personality.background}\n性格: {ai_personality.personality_traits}\n兴趣: {ai_personality.interests}\n沟通风格: {ai_personality.communication_style}")
        
        # 获取用户与 AI 的关系和互动历史
        relationship = None
        interaction_history = []
        if user_id:
            try:
                relationship = get_or_create_relationship(user_id)
                interaction_history = get_user_interaction_history(user_id)
                log_info(f"获取到用户关系 - 亲密度: {relationship.affinity_score}, 互动次数: {relationship.interaction_count}")
                log_info(f"获取到{len(interaction_history)}条历史互动记录")
            except DatabaseError as e:
                log_error(f"获取用户数据时出错: {str(e)}")
                # 继续执行，使用默认值
        
        # 构建提示词
        prompt = f"""あなたは{ai_personality.name}として以下の設定で返信を作成してください。

基本情報：
役職：{ai_personality.role}
経歴：{ai_personality.background}

性格：
{ai_personality.personality_traits}

興味・関心：
{ai_personality.interests}

コミュニケーションスタイル：
{ai_personality.communication_style}

"""

        # 添加互动历史
        if interaction_history:
            prompt += "\n過去の会話履歴（重要：ユーザーとの関係性を維持するため、これらの会話を考慮してください）：\n"
            for interaction in interaction_history:
                prompt += f"ユーザー: {interaction['user_content']}\n"
                prompt += f"momo: {interaction['ai_response']}\n"
                log_info(f"添加历史对话 - 用户: {interaction['user_content'][:50]}...")
                log_info(f"添加历史对话 - AI回复: {interaction['ai_response'][:50]}...")

        # 添加关系信息
        if relationship:
            prompt += f"""
現在の関係（重要）：
- 親密度: {relationship.affinity_score}/100 (この親密度に応じた適切な返信を心がけてください)
- 対話回数: {relationship.interaction_count}回
"""
            log_info(f"添加关系信息 - 亲密度: {relationship.affinity_score}, 对话次数: {relationship.interaction_count}")

        # 获取帖子上下文
        context = ""
        if post_id:
            try:
                post = Post.query.get(post_id)
                if post:
                    context = f"""スレッドのタイトル：{post.title}
スレッドの内容：{post.content}

これまでのコメント：
"""
                    comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.created_at.asc()).all()
                    for comment in comments:
                        if comment.user_id != MOMO_USER_ID:
                            context += f"- {comment.content}\n"
                    log_info(f"添加帖子上下文 - 标题: {post.title}, 评论数: {len(comments)}")
                    log_info(f"帖子内容: {post.content}")
                    log_info(f"评论内容: {[c.content for c in comments if c.user_id != MOMO_USER_ID]}")
            except Exception as e:
                log_error(f"获取帖子上下文时出错: {str(e)}")
                # 继续执行，使用空上下文

        prompt += f"""
スレッドの文脈：
{context}

直近の投稿：
{content}

以下の要件で返信を作成してください：
1. AIアシスタントではなく、コミュニティマネージャーとして自然に返信
2. 過去の会話履歴を必ず参照し、一貫性のある返信を心がける
3. 文脈に沿った具体的な返信
4. 親密度に応じた適切な距離感（親密度が高いほど親しみやすい口調で）
5. 返信は100文字以内
6. 絵文字や顔文字は控えめに
7. 相手の日本語の間違いがあれば、さりげなく正しい表現を示す
8. ユーザーとの過去の関係性を意識した返信

返信を作成してください。"""

        log_info("生成提示词完成，开始调用API")
        log_info(f"完整提示词内容:\n{prompt}")
        
        try:
            generation_config = {
                "temperature": 0.9,
                "top_p": 0.9,
                "top_k": 40,
                "max_output_tokens": 1024,
            }

            response = model.generate_content(prompt, generation_config=generation_config)
            
            if not response or not response.text:
                raise AIResponseError("API返回空响应")
            
            ai_response = response.text.strip()
            log_info(f"AI回复生成成功: {ai_response}")
            
            # 保存互动记录
            if user_id:
                try:
                    # 分析情感
                    sentiment_score = analyze_sentiment(content)
                    log_info(f"情感分析得分: {sentiment_score}")
                    
                    # 保存记忆
                    memory = AIMemory(
                        user_id=user_id,
                        post_id=post_id,
                        interaction_content=content,
                        ai_response=ai_response,
                        sentiment_score=sentiment_score
                    )
                    db.session.add(memory)
                    
                    # 更新关系
                    if relationship:
                        old_affinity = relationship.affinity_score
                        relationship.adjust_affinity(sentiment_score)
                        log_info(f"更新亲密度: {old_affinity} -> {relationship.affinity_score}")
                    
                    db.session.commit()
                    log_info("成功保存互动记录和更新关系")
                except Exception as e:
                    log_error(f"保存互动记录时出错: {str(e)}")
                    db.session.rollback()
                    # 继续执行，不影响回复生成
            
            return ai_response
            
        except Exception as api_error:
            log_error(f"调用API时出错: {str(api_error)}")
            raise AIResponseError("生成回复失败") from api_error

    except Exception as e:
        log_error(f"生成AI回复时出错: {str(e)}", exc_info=True)
        if isinstance(e, (AIResponseError, DatabaseError)):
            raise
        raise AIResponseError("生成回复时发生未知错误") from e

@forum_bp.route('/')
@login_required
def forum_page():
    """渲染掲示板主页"""
    current_user = User.query.get(session['user_id'])
    return render_template('forum.html', active_tab='forum', current_user=current_user)

@forum_bp.route('/api/posts', methods=['GET'])
@login_required
def get_posts():
    """获取帖子列表，支持标签过滤"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        tag_id = request.args.get('tag_id', type=int)
        
        # 构建查询
        query = db.session.query(Post, User).join(User, Post.user_id == User.id)
        
        # 如果指定了标签，添加标签过滤
        if tag_id:
            query = query.join(Post.tags).filter(Tag.id == tag_id)
            
        # 添加排序
        query = query.order_by(Post.created_at.desc())
        
        # 执行分页
        posts = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # 构建响应数据
        posts_data = [{
            'id': post.Post.id,
            'title': post.Post.title,
            'content': post.Post.content,
            'author_id': post.User.id,
            'author_name': post.User.username,
            'avatar_data': post.User.avatar_data if post.User.avatar_data else None,
            'created_at': post.Post.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'comment_count': Comment.query.filter_by(post_id=post.Post.id).count(),
            'tags': [{
                'id': tag.id,
                'name': tag.name,
                'color': tag.color
            } for tag in post.Post.tags]
        } for post in posts.items]
        
        return jsonify({
            'posts': posts_data,
            'total': posts.total,
            'pages': posts.pages,
            'current_page': posts.page
        })
    except Exception as e:
        log_error(f"获取帖子列表时出错: {str(e)}")
        return jsonify({'error': '投稿の取得に失敗しました'}), 500

@forum_bp.route('/api/posts/<int:post_id>', methods=['GET'])
@login_required
def get_post(post_id):
    """获取帖子详情，包含标签信息"""
    try:
        post = db.session.query(Post, User)\
            .join(User, Post.user_id == User.id)\
            .filter(Post.id == post_id)\
            .first_or_404()
        
        return jsonify({
            'id': post.Post.id,
            'title': post.Post.title,
            'content': post.Post.content,
            'author_id': post.User.id,
            'author_name': post.User.username,
            'author_avatar_data': post.User.avatar_data if post.User.avatar_data else None,
            'created_at': post.Post.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'tags': [{
                'id': tag.id,
                'name': tag.name,
                'color': tag.color
            } for tag in post.Post.tags]
        })
    except Exception as e:
        log_error(f"获取帖子详情时出错: {str(e)}")
        return jsonify({'error': '投稿的詳細の取得に失敗しました'}), 500

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
            'author_id': comment.User.id,
            'author_name': comment.User.username,
            'author_avatar_data': comment.User.avatar_data if comment.User.avatar_data else None,
            'created_at': comment.Comment.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for comment in comments])
    except Exception as e:
        log_error(f"获取评论时出错: {str(e)}")
        return jsonify({'error': '获取评论失败'}), 500

@forum_bp.route('/api/posts', methods=['POST'])
@login_required
def create_post():
    """创建新帖子，支持标签"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '無効なリクエストデータです'}), 400
            
        title = data.get('title')
        content = data.get('content')
        tag_ids = data.get('tag_ids', [])
        
        if not title or not content:
            return jsonify({'error': 'タイトルと内容は必須です'}), 400
            
        # 创建帖子
        post = Post(
            title=title,
            content=content,
            user_id=session['user_id']
        )
        
        # 添加标签
        if tag_ids:
            tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()
            post.tags.extend(tags)
            
        db.session.add(post)
        db.session.commit()
        
        # 检查是否需要AI回复
        if '@momo' in content.lower():
            thread = threading.Thread(target=add_ai_response_with_app, 
                                   args=(current_app._get_current_object(), post.id, content))
            thread.start()
        
        return jsonify({
            'id': post.id,
            'title': post.title,
            'content': post.content,
            'author_name': post.user.username,
            'created_at': post.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'tags': [{
                'id': tag.id,
                'name': tag.name,
                'color': tag.color
            } for tag in post.tags]
        })
    except Exception as e:
        db.session.rollback()
        log_error(f"创建帖子时出错: {str(e)}")
        return jsonify({'error': '投稿的作成に失敗しました'}), 500

def add_ai_response_with_app(app, post_id, content, user_id=None):
    """在应用上下文中添加 AI 回复"""
    if not app:
        log_error("应用上下文对象为空")
        return False
        
    try:
        with app.app_context():
            return add_ai_response(post_id, content, user_id)
    except Exception as e:
        log_error(f"添加 AI 回复时出错: {str(e)}")
        return False

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
        
        # 获取用户信息
        user = User.query.get(user_id)
        
        # 获取更新后的评论数
        updated_comment_count = Comment.query.filter_by(post_id=post_id).count()
        
        # 准备响应数据
        response_data = {
            'id': comment.id,
            'content': comment.content,
            'author_id': user_id,
            'author_name': user.username,
            'author_avatar_data': user.avatar_data if user.avatar_data else None,
            'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_comment_count': updated_comment_count
        }
        
        # 检查是否包含 @momo，在后台异步处理 AI 回复
        if '@momo' in content:
            try:
                thread = threading.Thread(
                    target=add_ai_response_with_app,
                    args=(current_app._get_current_object(), post_id, content, user_id),
                    daemon=True
                )
                thread.start()
                log_info(f"已启动 AI 回复线程，post_id: {post_id}")
            except Exception as e:
                log_error(f"启动 AI 回复线程失败: {str(e)}")
                # 继续执行，不影响评论创建
        
        return jsonify(response_data)
    except Exception as e:
        db.session.rollback()
        log_error(f"创建评论时出错: {str(e)}")
        if isinstance(e, DatabaseError):
            return jsonify({'error': '数据库操作失败'}), 500
        return jsonify({'error': '创建评论失败'}), 500

@forum_bp.route('/api/user/<int:user_id>', methods=['GET'])
@login_required
def get_user_info(user_id):
    """获取用户信息"""
    try:
        user = User.query.get_or_404(user_id)
        
        # 获取用户的帖子和评论数量
        post_count = Post.query.filter_by(user_id=user_id).count()
        comment_count = Comment.query.filter_by(user_id=user_id).count()
        
        # 获取用户的平均分数
        avg_reading_score = user.avg_reading_score
        avg_topic_score = user.avg_topic_score
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'avatar_data': user.avatar_data if user.avatar_data else None,
                'created_at': user.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'post_count': post_count,
                'comment_count': comment_count,
                'avg_reading_score': round(float(avg_reading_score), 1) if avg_reading_score else 0,
                'avg_topic_score': round(float(avg_topic_score), 1) if avg_topic_score else 0,
                'birthday': user.birthday.strftime('%Y-%m-%d') if user.birthday else None,
                'mbti': user.mbti if hasattr(user, 'mbti') else None,
                'bio': user.bio if hasattr(user, 'bio') else None
            }
        })
    except Exception as e:
        log_error(f"获取用户信息时出错: {str(e)}")
        return jsonify({
            'success': False,
            'error': '获取用户信息失败'
        }), 500 

@forum_bp.route('/api/user/<int:user_id>/posts', methods=['GET'])
@login_required
def get_user_posts(user_id):
    """获取用户的帖子列表"""
    try:
        # 获取用户的帖子并包含评论数
        posts = db.session.query(Post, User)\
            .join(User, Post.user_id == User.id)\
            .filter(Post.user_id == user_id)\
            .order_by(Post.created_at.desc())\
            .all()
        
        posts_data = [{
            'id': post.Post.id,
            'title': post.Post.title,
            'content': post.Post.content,
            'created_at': post.Post.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'comment_count': Comment.query.filter_by(post_id=post.Post.id).count()
        } for post in posts]
        
        return jsonify({
            'success': True,
            'posts': posts_data
        })
    except Exception as e:
        log_error(f"获取用户帖子列表时出错: {str(e)}")
        return jsonify({
            'success': False,
            'error': '获取用户帖子列表失败'
        }), 500 

@forum_bp.route('/api/tags', methods=['GET'])
@login_required
def get_tags():
    """获取所有标签"""
    try:
        tags = Tag.query.all()
        return jsonify([{
            'id': tag.id,
            'name': tag.name,
            'color': tag.color
        } for tag in tags])
    except Exception as e:
        log_error(f"获取标签列表时出错: {str(e)}")
        return jsonify({'error': 'タグの取得に失敗しました'}), 500

@forum_bp.route('/api/tags', methods=['POST'])
@login_required
def create_tag_api():
    """创建新标签或获取已存在的标签"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'タグ名は必須です'}), 400

        # 检查标签是否已存在
        tag = Tag.query.filter_by(name=name).first()
        if tag:
            return jsonify({
                'id': tag.id,
                'name': tag.name,
                'color': tag.color
            })

        # 生成柔和的颜色
        import random
        hue = random.randint(0, 360)
        color = f"hsl({hue}, 70%, 80%)"

        # 创建新标签
        tag = Tag(name=name, color=color)
        db.session.add(tag)
        db.session.commit()

        return jsonify({
            'id': tag.id,
            'name': tag.name,
            'color': tag.color
        })
    except Exception as e:
        db.session.rollback()
        log_error(f"创建标签时出错: {str(e)}")
        return jsonify({'error': 'タグ的作成に失敗しました'}), 500 

@forum_bp.route('/posts/<int:post_id>/comments', methods=['POST'])
@login_required
def add_comment(post_id):
    """添加评论"""
    try:
        content = request.json.get('content', '').strip()
        if not content:
            return jsonify({'error': 'コメント内容を入力してください'}), 400

        # 创建评论
        comment = Comment(
            content=content,
            post_id=post_id,
            user_id=session['user_id'],
            created_at=datetime.now()
        )
        db.session.add(comment)
        db.session.commit()

        # 检查是否需要 AI 回复
        if '@momo' in content:
            try:
                # 传递当前用户的 ID
                add_ai_response(post_id, content, session['user_id'])
            except (AIResponseError, DatabaseError) as e:
                log_error(f"AI 回复生成失败: {str(e)}")
                # 继续执行，不影响评论创建

        return jsonify({
            'message': 'コメントを追加しました',
            'comment': comment.serialize
        })
    except Exception as e:
        db.session.rollback()
        log_error(f"添加评论时出错: {str(e)}")
        if isinstance(e, DatabaseError):
            return jsonify({'error': 'データベース操作に失敗しました'}), 500
        return jsonify({'error': 'コメントの追加に失敗しました'}), 500 

@forum_bp.route('/')
def index():
    """论坛首页"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        
        # 获取所有标签
        tags = Tag.query.all()
        
        # 获取筛选条件
        selected_tags = request.args.getlist('tags')
        search_query = request.args.get('q', '').strip()
        
        # 构建查询
        query = Post.query
        
        # 应用标签筛选
        if selected_tags:
            query = query.join(Post.tags).filter(Tag.name.in_(selected_tags))
            
        # 应用搜索筛选
        if search_query:
            query = query.filter(
                db.or_(
                    Post.title.ilike(f'%{search_query}%'),
                    Post.content.ilike(f'%{search_query}%')
                )
            )
        
        # 按创建时间倒序排序并分页
        posts = query.order_by(Post.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return render_template(
            'forum/index.html',
            posts=posts,
            tags=tags,
            selected_tags=selected_tags,
            search_query=search_query
        )
    except Exception as e:
        log_error(f"获取论坛首页时出错: {str(e)}")
        return render_template('error.html', message='ページの読み込みに失敗しました')

@forum_bp.route('/posts/new', methods=['GET', 'POST'])
@login_required
def new_post():
    """创建新帖子"""
    if request.method == 'POST':
        try:
            title = request.form.get('title', '').strip()
            content = request.form.get('content', '').strip()
            tag_names = request.form.getlist('tags')
            
            if not title or not content:
                return jsonify({'error': 'タイトルと内容を入力してください'}), 400
            
            # 创建帖子
            post = Post(
                title=title,
                content=content,
                user_id=session['user_id']
            )
            
            # 添加标签
            if tag_names:
                tags = Tag.query.filter(Tag.name.in_(tag_names)).all()
                post.tags.extend(tags)
            
            db.session.add(post)
            db.session.commit()
            
            # 如果内容中包含 @momo，添加 AI 回复
            if '@momo' in content:
                add_ai_response(post.id, content, session['user_id'])
            
            return redirect(url_for('forum.view_post', post_id=post.id))
        except Exception as e:
            db.session.rollback()
            log_error(f"创建帖子时出错: {str(e)}")
            return jsonify({'error': '投稿的作成に失敗しました'}), 500
    
    # GET 请求，显示创建帖子的表单
    tags = Tag.query.all()
    return render_template('forum/new_post.html', tags=tags)

@forum_bp.route('/posts/<int:post_id>')
def view_post(post_id):
    """查看帖子详情"""
    try:
        post = Post.query.get_or_404(post_id)
        return render_template('forum/post.html', post=post)
    except Exception as e:
        log_error(f"获取帖子详情时出错: {str(e)}")
        return render_template('error.html', message='投稿的読み込みに失敗しました')

@forum_bp.route('/posts/<int:post_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_post(post_id):
    """编辑帖子"""
    post = Post.query.get_or_404(post_id)
    
    # 检查权限
    if post.user_id != session['user_id']:
        return jsonify({'error': '編集権限がありません'}), 403
    
    if request.method == 'POST':
        try:
            title = request.form.get('title', '').strip()
            content = request.form.get('content', '').strip()
            tag_names = request.form.getlist('tags')
            
            if not title or not content:
                return jsonify({'error': 'タイトルと内容を入力してください'}), 400
            
            # 更新帖子
            post.title = title
            post.content = content
            
            # 更新标签
            post.tags.clear()
            if tag_names:
                tags = Tag.query.filter(Tag.name.in_(tag_names)).all()
                post.tags.extend(tags)
            
            db.session.commit()
            return redirect(url_for('forum.view_post', post_id=post.id))
        except Exception as e:
            db.session.rollback()
            log_error(f"更新帖子时出错: {str(e)}")
            return jsonify({'error': '投稿的更新に失敗しました'}), 500
    
    # GET 请求，显示编辑表单
    tags = Tag.query.all()
    return render_template('forum/edit_post.html', post=post, tags=tags)

@forum_bp.route('/posts/<int:post_id>/delete', methods=['POST'])
@login_required
def delete_post(post_id):
    """删除帖子"""
    try:
        post = Post.query.get_or_404(post_id)
        
        # 检查权限
        if post.user_id != session['user_id']:
            return jsonify({'error': '削除権限がありません'}), 403
        
        db.session.delete(post)
        db.session.commit()
        
        return redirect(url_for('forum.index'))
    except Exception as e:
        db.session.rollback()
        log_error(f"删除帖子时出错: {str(e)}")
        return jsonify({'error': '投稿的削除に失敗しました'}), 500

@forum_bp.route('/comments/<int:comment_id>/delete', methods=['POST'])
@login_required
def delete_comment(comment_id):
    """删除评论"""
    try:
        comment = Comment.query.get_or_404(comment_id)
        
        # 检查权限
        if comment.user_id != session['user_id']:
            return jsonify({'error': '削除権限がありません'}), 403
        
        post_id = comment.post_id
        db.session.delete(comment)
        db.session.commit()
        
        return redirect(url_for('forum.view_post', post_id=post_id))
    except Exception as e:
        db.session.rollback()
        log_error(f"删除评论时出错: {str(e)}")
        return jsonify({'error': 'コメント的削除に失敗しました'}), 500

@forum_bp.route('/tags/new', methods=['POST'])
@login_required
def create_tag():
    """创建新标签"""
    try:
        name = request.json.get('name', '').strip()
        color = request.json.get('color', '#000000').strip()
        
        if not name:
            return jsonify({'error': 'タグ名を入力してください'}), 400
        
        # 检查标签是否已存在
        if Tag.query.filter_by(name=name).first():
            return jsonify({'error': 'このタグは既に存在します'}), 400
        
        # 创建标签
        tag = Tag(name=name, color=color)
        db.session.add(tag)
        db.session.commit()
        
        return jsonify({
            'message': 'タグを作成しました',
            'tag': {'id': tag.id, 'name': tag.name, 'color': tag.color}
        })
    except Exception as e:
        db.session.rollback()
        log_error(f"创建标签时出错: {str(e)}")
        return jsonify({'error': 'タグ的作成に失敗しました'}), 500

@forum_bp.route('/tags/<int:tag_id>/delete', methods=['POST'])
@login_required
def delete_tag(tag_id):
    """删除标签"""
    try:
        tag = Tag.query.get_or_404(tag_id)
        db.session.delete(tag)
        db.session.commit()
        
        return jsonify({'message': 'タグを削除しました'})
    except Exception as e:
        db.session.rollback()
        log_error(f"删除标签时出错: {str(e)}")
        return jsonify({'error': 'タグ的削除に失敗しました'}), 500 

@forum_bp.route('/momo')
def momo_profile():
    """AI助手的个人资料页面"""
    try:
        # 获取 AI 人格设定
        ai_personality = AIPersonality.query.first()
        if not ai_personality:
            from app.ai_personality_init import init_ai_personality
            init_ai_personality()
            ai_personality = AIPersonality.query.first()
        
        # 获取用户与 AI 的关系
        relationship = None
        if 'user_id' in session:
            relationship = AIRelationship.query.filter_by(user_id=session['user_id']).first()
        
        # 获取最近的互动记录
        recent_interactions = []
        if 'user_id' in session:
            memories = AIMemory.query.filter_by(user_id=session['user_id']).order_by(AIMemory.created_at.desc()).limit(10).all()
            for memory in memories:
                recent_interactions.append({
                    'user_content': memory.interaction_content,
                    'ai_response': memory.ai_response,
                    'created_at': memory.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    'sentiment_score': memory.sentiment_score
                })
        
        # 获取 AI 的统计数据
        total_interactions = AIMemory.query.count()
        total_users = db.session.query(db.func.count(db.distinct(AIMemory.user_id))).scalar()
        avg_sentiment = db.session.query(db.func.avg(AIMemory.sentiment_score)).scalar() or 0
        
        return render_template(
            'forum/momo_profile.html',
            ai_personality=ai_personality,
            relationship=relationship,
            recent_interactions=recent_interactions,
            total_interactions=total_interactions,
            total_users=total_users,
            avg_sentiment=round(float(avg_sentiment), 2)
        )
    except Exception as e:
        log_error(f"获取AI助手个人资料时出错: {str(e)}")
        return render_template('error.html', message='ページの読み込みに失敗しました') 