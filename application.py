import requests
import base64
import json
import time
import random
import azure.cognitiveservices.speech as speechsdk
import logging
from config import SUBSCRIPTION_KEY, REGION, LANGUAGE, VOICE
from flask import Flask, jsonify, render_template, request, make_response, redirect, url_for, flash, session, Response, stream_with_context
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from models import db, User, StudyRecord
import os
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///japanese_study.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['DEBUG'] = True  # 添加调试模式

# 初始化数据库
db.init_app(app)

# 初始化登录管理器
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# 配置日志记录
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

@app.route("/")
def index():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
        
    # 获取用户的朗读记录
    reading_records = StudyRecord.query.filter_by(
        user_id=current_user.id,
        activity_type='reading'
    ).order_by(StudyRecord.created_at.desc()).limit(5).all()
    
    # 获取用户的Topic记录
    topic_records = StudyRecord.query.filter_by(
        user_id=current_user.id,
        activity_type='topic'
    ).order_by(StudyRecord.created_at.desc()).limit(5).all()
    
    # 获取朗读排行榜（使用每个用户的最高平均分）
    reading_rankings = db.session.query(
        User.username,
        db.func.max(
            (StudyRecord.accuracy_score + 
             StudyRecord.fluency_score + 
             StudyRecord.completeness_score + 
             StudyRecord.pronunciation_score) / 4
        ).label('score')
    ).join(StudyRecord).filter(
        StudyRecord.activity_type == 'reading',
        StudyRecord.accuracy_score.isnot(None),
        StudyRecord.fluency_score.isnot(None),
        StudyRecord.completeness_score.isnot(None),
        StudyRecord.pronunciation_score.isnot(None)
    ).group_by(User.id, User.username).order_by(
        db.text('score DESC')
    ).limit(10).all()
    
    # 获取Topic排行榜（使用每个用户的最高平均分）
    topic_rankings = db.session.query(
        User.username,
        db.func.max(
            (StudyRecord.grammar_score + 
             StudyRecord.content_score + 
             StudyRecord.relevance_score) / 3
        ).label('score')
    ).join(StudyRecord).filter(
        StudyRecord.activity_type == 'topic',
        StudyRecord.grammar_score.isnot(None),
        StudyRecord.content_score.isnot(None),
        StudyRecord.relevance_score.isnot(None)
    ).group_by(User.id, User.username).order_by(
        db.text('score DESC')
    ).limit(10).all()
    
    return render_template("index.html",
                         reading_records=reading_records,
                         topic_records=topic_records,
                         reading_rankings=reading_rankings,
                         topic_rankings=topic_rankings)

@app.route("/login", methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('index'))
        else:
            flash('ユーザー名またはパスワードが間違っています')
    return render_template('login.html')

@app.route("/register", methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not username or not password:
            flash('ユーザー名とパスワードを入力してください')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('パスワードが一致しません')
            return render_template('register.html')
            
        if User.query.filter_by(username=username).first():
            flash('このユーザー名は既に使用されています')
            return render_template('register.html')
            
        try:
            user = User(username=username)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            
            login_user(user)
            return redirect(url_for('index'))
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Registration error: {str(e)}")
            flash('登録中にエラーが発生しました。もう一度お試しください。')
            return render_template('register.html')
            
    return render_template('register.html')

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route("/profile")
@login_required
def profile():
    study_records = StudyRecord.query.filter_by(user_id=current_user.id).order_by(StudyRecord.created_at.desc()).limit(10).all()
    return render_template("profile.html", user=current_user, study_records=study_records)

@app.route("/readalong")
def readalong():
    return render_template("readalong.html")

@app.route("/gettoken", methods=["POST"])
def gettoken():
    fetch_token_url = 'https://%s.api.cognitive.microsoft.com/sts/v1.0/issueToken' %REGION
    headers = {
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
    }
    response = requests.post(fetch_token_url, headers=headers)
    access_token = response.text
    return jsonify({"at":access_token})


@app.route("/gettonguetwister", methods=["POST"])
def gettonguetwister():
    tonguetwisters = [
        "お世話になっております。",
        "ご確認のほどよろしくお願いいたします。",
        "お手数をおかけしますが、よろしくお願いいたします。",
        "ご返信お待ちしております。",
        "ご指摘いただきありがとうございます。",
        "お忙しいところ恐縮ですが、ご確認ください。",
        "ご協力いただきありがとうございます。",
        "今後ともよろしくお願いいたします。",
        "お時間をいただきありがとうございます。",
        "ご理解のほどよろしくお願いいたします。",
        "お手数ですが、再度ご確認ください。",
        "ご不明な点がございましたら、お知らせください。",
        "お手数をおかけいたしますが、何卒よろしくお願いいたします。",
        "ご対応いただきありがとうございます。",
        "お返事をお待ちしております。",
        "ご確認いただきありがとうございます。"
    ]
    
    return jsonify({"tt":random.choice(tonguetwisters)})

@app.route("/getstory", methods=["POST"])
def getstory():
    id = int(request.form.get("id"))
    stories = [["Read aloud the sentences on the screen.",
        "We will follow along your speech and help you learn speak English.",
        "Good luck for your reading lesson!"],
        ["The Hare and the Tortoise",
        "Once upon a time, a Hare was making fun of the Tortoise for being so slow.",
        "\"Do you ever get anywhere?\" he asked with a mocking laugh.",
        "\"Yes,\" replied the Tortoise, \"and I get there sooner than you think. Let us run a race.\"",
        "The Hare was amused at the idea of running a race with the Tortoise, but agreed anyway.",
        "So the Fox, who had consented to act as judge, marked the distance and started the runners off.",
        "The Hare was soon far out of sight, and in his overconfidence,",
        "he lay down beside the course to take a nap until the Tortoise should catch up.",
        "Meanwhile, the Tortoise kept going slowly but steadily, and, after some time, passed the place where the Hare was sleeping.",
        "The Hare slept on peacefully; and when at last he did wake up, the Tortoise was near the goal.",
        "The Hare now ran his swiftest, but he could not overtake the Tortoise in time.",
        "Slow and Steady wins the race."],
        ["The Ant and The Dove",
        "A Dove saw an Ant fall into a brook.",
        "The Ant struggled in vain to reach the bank,",
        "and in pity, the Dove dropped a blade of straw close beside it.",
        "Clinging to the straw like a shipwrecked sailor, the Ant floated safely to shore.",
        "Soon after, the Ant saw a man getting ready to kill the Dove with a stone.",
        "Just as he cast the stone, the Ant stung the man in the heel, and he missed his aim,",
        "The startled Dove flew to safety in a distant wood and lived to see another day.",
        "A kindness is never wasted."]]
    if(id >= len(stories)):
        return jsonify({"code":201})
    else:
        return jsonify({"code":200,"storyid":id , "storynumelements":len(stories[id]),"story": stories[id]})

@app.route("/ackaud", methods=["POST"])
def ackaud():
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
        
    f = request.files['audio_data']
    reftext = request.form.get("reftext")
    
    # a generator which reads audio data chunk by chunk
    # the audio_source can be any audio input stream which provides read() method, e.g. audio file, microphone, memory stream, etc.
    def get_chunk(audio_source, chunk_size=1024):
        while True:
            #time.sleep(chunk_size / 32000) # to simulate human speaking rate
            chunk = audio_source.read(chunk_size)
            if not chunk:
                #global uploadFinishTime
                #uploadFinishTime = time.time()
                break
            yield chunk

    # build pronunciation assessment parameters
    referenceText = reftext
    pronAssessmentParamsJson = "{\"ReferenceText\":\"%s\",\"GradingSystem\":\"HundredMark\",\"Dimension\":\"Comprehensive\",\"EnableMiscue\":\"True\"}" % referenceText
    pronAssessmentParamsBase64 = base64.b64encode(bytes(pronAssessmentParamsJson, 'utf-8'))
    pronAssessmentParams = str(pronAssessmentParamsBase64, "utf-8")

    # build request
    url = "https://%s.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=%s&usePipelineVersion=0" % (REGION, LANGUAGE)
    headers = { 'Accept': 'application/json;text/xml',
                'Connection': 'Keep-Alive',
                'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                'Pronunciation-Assessment': pronAssessmentParams,
                'Transfer-Encoding': 'chunked',
                'Expect': '100-continue' }

    #audioFile = open('audio.wav', 'rb')
    audioFile = f
    # send request with chunked data
    response = requests.post(url=url, data=get_chunk(audioFile), headers=headers)
    #getResponseTime = time.time()
    audioFile.close()

    #latency = getResponseTime - uploadFinishTime
    #print("Latency = %sms" % int(latency * 1000))

    # 保存评估结果到数据库
    try:
        result = response.json()
        logging.info(f"Pronunciation assessment result: {result}")
        
        # 从 NBest 数组中获取第一个结果
        if 'NBest' in result and len(result['NBest']) > 0:
            nbest = result['NBest'][0]
            
            # 提取分数
            accuracy_score = float(nbest.get('AccuracyScore', 0))
            fluency_score = float(nbest.get('FluencyScore', 0))
            completeness_score = float(nbest.get('CompletenessScore', 0))
            pronunciation_score = float(nbest.get('PronScore', 0))
            
            # 记录分数
            logging.info(f"Scores - Accuracy: {accuracy_score}, Fluency: {fluency_score}, "
                        f"Completeness: {completeness_score}, Pronunciation: {pronunciation_score}")
            
            # 创建学习记录
            record = StudyRecord(
                user_id=current_user.id,
                activity_type='reading',
                content=reftext,
                accuracy_score=accuracy_score,
                fluency_score=fluency_score,
                completeness_score=completeness_score,
                pronunciation_score=pronunciation_score
            )
            db.session.add(record)
            db.session.commit()
            logging.info(f"Successfully saved reading record for user {current_user.id}")
        else:
            logging.error("No NBest results found in the response")
            
    except Exception as e:
        logging.error(f"Error saving reading record: {str(e)}")
        db.session.rollback()
        
    return response.json()

@app.route("/gettts", methods=["POST"])
def gettts():
    reftext = request.form.get("reftext")
    # Creates an instance of a speech config with specified subscription key and service region.
    speech_config = speechsdk.SpeechConfig(subscription=SUBSCRIPTION_KEY, region=REGION)
    speech_config.speech_synthesis_voice_name = VOICE

    offsets=[]

    def wordbound(evt):
        offsets.append( evt.audio_offset / 10000)

    # Creates a speech synthesizer with a null output stream.
    # This means the audio output data will not be written to any output channel.
    # You can just get the audio from the result.
    speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

    # Subscribes to word boundary event
    # The unit of evt.audio_offset is tick (1 tick = 100 nanoseconds), divide it by 10,000 to convert to milliseconds.
    speech_synthesizer.synthesis_word_boundary.connect(wordbound)

    result = speech_synthesizer.speak_text_async(reftext).get()
    # Check result
    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        #print("Speech synthesized for text [{}]".format(reftext))
        #print(offsets)
        audio_data = result.audio_data
        #print(audio_data)
        #print("{} bytes of audio data received.".format(len(audio_data)))
        
        response = make_response(audio_data)
        response.headers['Content-Type'] = 'audio/wav'
        response.headers['Content-Disposition'] = 'attachment; filename=sound.wav'
        # response.headers['reftext'] = reftext
        response.headers['offsets'] = offsets
        return response
        
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation_details = result.cancellation_details
        print("Speech synthesis canceled: {}".format(cancellation_details.reason))
        if cancellation_details.reason == speechsdk.CancellationReason.Error:
            print("Error details: {}".format(cancellation_details.error_details))
        return jsonify({"success":False})

@app.route("/getttsforword", methods=["POST"])
def getttsforword():
    """获取单个单词的TTS音频"""
    try:
        word = request.form.get("word")
        if not word:
            return jsonify({"error": "単語が指定されていません。"}), 400
            
        speech_config = speechsdk.SpeechConfig(
            subscription=SUBSCRIPTION_KEY, 
            region=REGION
        )
        speech_config.speech_synthesis_voice_name = VOICE
        
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, 
            audio_config=None
        )
        
        result = synthesizer.speak_text_async(word).get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return Response(
                result.audio_data,
                mimetype="audio/wav"
            )
        else:
            return jsonify({"error": "音声の生成に失敗しました。"}), 500
            
    except Exception as e:
        app.logger.error(f"TTS error: {str(e)}")
        return jsonify({"error": "音声の生成中にエラーが発生しました。"}), 500

@app.route("/generate_text", methods=["POST"])
def generate_text():
    """生成随机练习文本"""
    texts = [
        "日本の伝統文化は世界中で高く評価されています。",
        "桜の季節は日本の春を代表する風物詩です。",
        "和食は健康的で栄養バランスが良いと言われています。",
        "日本の四季は、それぞれ異なる美しさを見せてくれます。",
        "茶道は、日本の精神文化を象徴する芸術です。",
        "日本の技術革新は、世界の発展に貢献しています。",
        "富士山は、日本の象徴として世界に知られています。",
        "日本の教育システムは、世界から注目されています。",
        "日本の伝統工芸品は、職人の技術が活きています。",
        "日本のアニメやマンガは、世界中で人気があります。"
    ]
    return jsonify({"text": random.choice(texts)})

@app.route("/generate_topic", methods=["POST"])
def generate_topic():
    # 调用 Ollama 服务生成话题
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": "llama3.1:8b",
        "prompt": "日本語の会話練習のためのトピックを1つ提案してください。簡単な説明も付けてくさい。回答は100文字以内でお願いします。",
        "stream": False
    }

    try:
        logging.debug(f"Sending POST request to {url} with payload: {payload}")
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        topic = result.get("response", "トピック生成に失敗しました")
        return jsonify({"topic": topic.strip()})
    except requests.exceptions.RequestException as e:
        logging.error(f"Error calling Ollama service: {e}")
        return jsonify({"topic": "トピック生成に失敗しました"})

@app.route("/transcribe_audio", methods=["POST"])
def transcribe_audio():
    """处理Topic录音并返回评分"""
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
        
    try:
        audio_file = request.files.get('audio')
        topic = request.form.get('topic')
        
        if not audio_file or not topic:
            return jsonify({"error": "音声データまたはトピックが見つかりません。"}), 400
            
        # 配置语音识别
        speech_config = speechsdk.SpeechConfig(
            subscription=SUBSCRIPTION_KEY, 
            region=REGION
        )
        speech_config.speech_recognition_language = LANGUAGE
        
        # 创建音频配置
        audio_config = speechsdk.audio.AudioConfig(
            filename=audio_file.filename
        )
        
        # 创建语音识别器
        speech_recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config, 
            audio_config=audio_config
        )
        
        # 进行语音识别
        result = speech_recognizer.recognize_once_async().get()
        
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            text = result.text
            
            # 评估语法、内容和相关性
            grammar_score = random.uniform(60, 100)  # 示例：随机生成分数
            content_score = random.uniform(60, 100)
            relevance_score = random.uniform(60, 100)
            
            # 生成反馈
            feedback = "発音は明確で、文法も概ね正確です。内容をより充実させるために、具体例を加えることをお勧めします。"
            
            # 保存记录
            record = StudyRecord(
                user_id=current_user.id,
                activity_type='topic',
                reference_text=topic,
                spoken_text=text,
                grammar_score=grammar_score,
                content_score=content_score,
                relevance_score=relevance_score,
                feedback=feedback
            )
            db.session.add(record)
            db.session.commit()
            
            return jsonify({
                "text": text,
                "grammar_feedback": "文法の修正案をここに表示します。",
                "topic_feedback": {
                    "grammar_score": f"{grammar_score:.1f}",
                    "content_score": f"{content_score:.1f}",
                    "relevance_score": f"{relevance_score:.1f}",
                    "feedback": feedback
                }
            })
        else:
            return jsonify({"error": "音声を認識できませんでした。"}), 400
            
    except Exception as e:
        app.logger.error(f"Audio processing error: {str(e)}")
        return jsonify({"error": "音声の処理中にエラーが発生しました。"}), 500

@app.route("/get_grammar_feedback", methods=["POST"])
def grammar_feedback_api():
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
        
    text = request.json.get('text')
    if not text:
        return jsonify({"error": "テキストが必要です"}), 400
        
    feedback = get_grammar_feedback(text)
    return jsonify({"feedback": feedback})

@app.route("/get_topic_feedback", methods=["POST"])
def topic_feedback_api():
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
        
    text = request.json.get('text')
    topic = request.json.get('topic')
    if not text or not topic:
        return jsonify({"error": "テキストとトピックが必要です"}), 400
        
    feedback = get_topic_feedback(text, topic)
    
    # 保存记录
    try:
        record = StudyRecord(
            user_id=current_user.id,
            activity_type='topic',
            content=topic,
            user_input=text,
            grammar_score=float(feedback.get('grammar_score', 0)),
            content_score=float(feedback.get('content_score', 0)),
            relevance_score=float(feedback.get('relevance_score', 0)),
            feedback=feedback.get('feedback', '')
        )
        db.session.add(record)
        db.session.commit()
    except Exception as e:
        logging.error(f"Error saving topic record: {str(e)}")
        db.session.rollback()
        
    return jsonify(feedback)

def get_grammar_feedback(text):
    """获取语法纠正反馈"""
    url = "http://localhost:11434/api/generate"
    prompt = f"""以下の日本語文章を文法的に分析し、修正してください。
入力: {text}

以下の形式で回答してください：
1. 修正後の文章
2. 修正点の説明（箇条書き）

回答は日本語でお願いします。"""

    payload = {
        "model": "llama3.1:8b",
        "prompt": prompt,
        "stream": False
    }

    try:
        logging.debug(f"Sending grammar feedback request: {text}")
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        feedback = result.get("response", "")
        logging.debug(f"Received grammar feedback: {feedback}")
        if not feedback:
            return "申し訳ありませんが、分析に失敗しました。"
        return feedback
    except Exception as e:
        logging.error(f"Grammar feedback error: {e}")
        return "申し訳ありませんが、分析に失敗しました。"

def get_topic_feedback(text, topic):
    """获取主题相关的反馈和评分"""
    url = "http://localhost:11434/api/generate"
    prompt = f"""以下の回答を評価し、必ずJSON形式で返してください。

トピック: {topic}
回答: {text}

評価基準：
1. 文法の正確さ（0-100点）
2. 内容の充実度（0-100点）
3. トピックとの関連性（0-100点）
4. 改善点を含むフィードバック（200文字以内）

以下のJSON形式で返してください。他の文章は含めないでください：
{{
    "grammar_score": [文法の点数],
    "content_score": [内容の点数],
    "relevance_score": [関連性の点数],
    "feedback": "[改善点のフィードバック]"
}}"""

    payload = {
        "model": "llama3.1:8b",
        "prompt": prompt,
        "stream": False
    }

    try:
        logging.debug(f"Sending topic feedback request - Topic: {topic}, Text: {text}")
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        response_text = result.get("response", "")
        
        # 尝试从响应文本中提取JSON部分
        try:
            # 查找第一个 { 和最后一个 } 的位置
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start != -1 and end != -1:
                json_str = response_text[start:end]
                feedback_data = json.loads(json_str)
                logging.debug(f"Parsed topic feedback: {feedback_data}")
            else:
                raise ValueError("No JSON found in response")
                
            # 确保所有必需的字段都存在
            required_fields = ['grammar_score', 'content_score', 'relevance_score', 'feedback']
            for field in required_fields:
                if field not in feedback_data:
                    feedback_data[field] = 0 if 'score' in field else '評価の生成に失敗しました'
                    
            # 确保分数在0-100范围内
            for field in ['grammar_score', 'content_score', 'relevance_score']:
                try:
                    score = float(feedback_data[field])
                    feedback_data[field] = max(0, min(100, score))
                except (ValueError, TypeError):
                    feedback_data[field] = 0
                
            return feedback_data
            
        except (json.JSONDecodeError, ValueError) as e:
            logging.error(f"Error parsing topic feedback: {e}")
            return {
                "grammar_score": 0,
                "content_score": 0,
                "relevance_score": 0,
                "feedback": "評価の解析に失敗しました"
            }
    except Exception as e:
        logging.error(f"Topic feedback error: {e}")
        return {
            "grammar_score": 0,
            "content_score": 0,
            "relevance_score": 0,
            "feedback": "評価の生成に失敗しました"
        }

@app.route('/get_home_data')
@login_required
def get_home_data():
    # 获取阅读记录
    reading_records = db.session.query(StudyRecord).filter(
        StudyRecord.user_id == current_user.id,
        StudyRecord.activity_type == 'reading'
    ).order_by(StudyRecord.created_at.desc()).limit(10).all()

    # 获取Topic记录
    topic_records = db.session.query(StudyRecord).filter(
        StudyRecord.user_id == current_user.id,
        StudyRecord.activity_type == 'topic'
    ).order_by(StudyRecord.created_at.desc()).limit(10).all()

    # 获取阅读排行榜（使用平均分）
    reading_rankings = db.session.query(
        User.username,
        db.func.avg(
            (StudyRecord.accuracy_score + 
             StudyRecord.fluency_score + 
             StudyRecord.completeness_score + 
             StudyRecord.pronunciation_score) / 4
        ).label('score')
    ).join(StudyRecord).filter(
        StudyRecord.activity_type == 'reading',
        StudyRecord.accuracy_score.isnot(None),
        StudyRecord.fluency_score.isnot(None),
        StudyRecord.completeness_score.isnot(None),
        StudyRecord.pronunciation_score.isnot(None)
    ).group_by(User.id, User.username).order_by(
        db.desc('score')
    ).limit(5).all()

    # 获取Topic排行榜（使用平均分）
    topic_rankings = db.session.query(
        User.username,
        db.func.avg(
            (StudyRecord.grammar_score + 
             StudyRecord.content_score + 
             StudyRecord.relevance_score) / 3
        ).label('score')
    ).join(StudyRecord).filter(
        StudyRecord.activity_type == 'topic',
        StudyRecord.grammar_score.isnot(None),
        StudyRecord.content_score.isnot(None),
        StudyRecord.relevance_score.isnot(None)
    ).group_by(User.id, User.username).order_by(
        db.desc('score')
    ).limit(5).all()

    return jsonify({
        'reading_records': [{
            'created_at': record.created_at.strftime('%Y-%m-%d %H:%M'),
            'content': record.content,
            'accuracy_score': record.accuracy_score,
            'fluency_score': record.fluency_score,
            'completeness_score': record.completeness_score,
            'pronunciation_score': record.pronunciation_score
        } for record in reading_records],
        'topic_records': [{
            'created_at': record.created_at.strftime('%Y-%m-%d %H:%M'),
            'content': record.content,
            'user_input': record.user_input,
            'grammar_score': record.grammar_score,
            'content_score': record.content_score,
            'relevance_score': record.relevance_score,
            'feedback': record.feedback
        } for record in topic_records],
        'reading_rankings': [{
            'username': rank[0],
            'score': float(rank[1]) if rank[1] is not None else 0.0
        } for rank in reading_rankings],
        'topic_rankings': [{
            'username': rank[0],
            'score': float(rank[1]) if rank[1] is not None else 0.0
        } for rank in topic_rankings]
    })

@app.route('/get_chart_data', methods=["GET"])
@login_required
def get_chart_data():
    """获取用户的学习记录数据用于图表显示"""
    try:
        # 获取最近30天的记录
        start_date = datetime.now() - timedelta(days=30)
        
        # 获取朗读记录
        reading_records = StudyRecord.query.filter(
            StudyRecord.user_id == current_user.id,
            StudyRecord.activity_type == 'reading',
            StudyRecord.created_at >= start_date
        ).order_by(StudyRecord.created_at.asc()).all()
        
        # 获取Topic记录
        topic_records = StudyRecord.query.filter(
            StudyRecord.user_id == current_user.id,
            StudyRecord.activity_type == 'topic',
            StudyRecord.created_at >= start_date
        ).order_by(StudyRecord.created_at.asc()).all()
        
        # 处理朗读记录数据
        reading_data = []
        for i, record in enumerate(reading_records, 1):
            if record.accuracy_score and record.fluency_score and \
               record.completeness_score and record.pronunciation_score:
                avg_score = (record.accuracy_score + record.fluency_score + \
                           record.completeness_score + record.pronunciation_score) / 4
                reading_data.append({
                    "attempt": i,
                    "score": round(avg_score, 1)
                })
        
        # 处理Topic记录数据
        topic_data = []
        for i, record in enumerate(topic_records, 1):
            if record.grammar_score and record.content_score and record.relevance_score:
                avg_score = (record.grammar_score + record.content_score + \
                           record.relevance_score) / 3
                topic_data.append({
                    "attempt": i,
                    "score": round(avg_score, 1)
                })
        
        return jsonify({
            "reading_data": reading_data,
            "topic_data": topic_data
        })
        
    except Exception as e:
        app.logger.error(f"Chart data error: {str(e)}")
        return jsonify({"error": "データの取得中にエラーが発生しました。"}), 500

@app.route("/process_speech", methods=["POST"])
def process_speech():
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
        
    try:
        audio_file = request.files.get('audio')
        topic = request.form.get('topic')
        
        if not audio_file or not topic:
            return jsonify({"error": "音声データまたはトピックが見つかりません。"}), 400
            
        # 保存临时音频文件
        temp_path = f"/tmp/speech_{current_user.id}_{int(time.time())}.wav"
        audio_file.save(temp_path)
        
        try:
            # 配置语音识别
            speech_config = speechsdk.SpeechConfig(
                subscription=SUBSCRIPTION_KEY, 
                region=REGION
            )
            speech_config.speech_recognition_language = "ja-JP"
            
            # 创建音频配置
            audio_config = speechsdk.audio.AudioConfig(
                filename=temp_path
            )
            
            # 创建语音识别器
            speech_recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config, 
                audio_config=audio_config
            )
            
            # 进行语音识别
            result = speech_recognizer.recognize_once_async().get()
            
            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                transcription = result.text
                
                # 获取评分
                grammar_score = random.uniform(60, 100)  # 示例：随机生成分数
                content_score = random.uniform(60, 100)
                relevance_score = random.uniform(60, 100)
                
                # 生成反馈
                feedback = get_topic_feedback(transcription, topic)
                
                # 保存记录
                record = StudyRecord(
                    user_id=current_user.id,
                    activity_type='topic',
                    reference_text=topic,
                    spoken_text=transcription,
                    grammar_score=grammar_score,
                    content_score=content_score,
                    relevance_score=relevance_score,
                    feedback=feedback.get('feedback', '')
                )
                db.session.add(record)
                db.session.commit()
                
                return jsonify({
                    "transcription": transcription,
                    "scores": {
                        "grammar_score": grammar_score,
                        "content_score": content_score,
                        "relevance_score": relevance_score
                    },
                    "feedback": feedback.get('feedback', '')
                })
            else:
                return jsonify({"error": "音声を認識できませんでした。"}), 400
                
        finally:
            # 清理临时文件
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except Exception as e:
        app.logger.error(f"Audio processing error: {str(e)}")
        return jsonify({"error": "音声の処理中にエラーが発生しました。"}), 500

@app.route('/get_user_scores')
@login_required
def get_user_scores():
    try:
        # 获取用户最近30天的学习记录
        thirty_days_ago = datetime.now() - timedelta(days=30)
        records = StudyRecord.query.filter(
            StudyRecord.user_id == current_user.id,
            StudyRecord.created_at >= thirty_days_ago
        ).order_by(StudyRecord.created_at.asc()).all()

        dates = []
        pronunciation_scores = []
        fluency_scores = []
        completeness_scores = []

        for record in records:
            dates.append(record.created_at.strftime('%Y-%m-%d'))
            pronunciation_scores.append(record.pronunciation_score)
            fluency_scores.append(record.fluency_score)
            completeness_scores.append(record.completeness_score)

        return jsonify({
            'dates': dates,
            'pronunciation_scores': pronunciation_scores,
            'fluency_scores': fluency_scores,
            'completeness_scores': completeness_scores
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 创建数据库表
with app.app_context():
    db.create_all()