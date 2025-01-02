import requests
import base64
import json
import time
import random
import azure.cognitiveservices.speech as speechsdk
import logging
import google.generativeai as genai
from config import SUBSCRIPTION_KEY, REGION, LANGUAGE, VOICE, GEMINI_API_KEY, GEMINI_MODEL
from flask import Flask, jsonify, render_template, request, make_response, redirect, url_for, session, flash
from models import db, User, ReadingRecord, TopicRecord
from functools import wraps
from vocabulary import vocabulary_bp
from forum import forum_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'  # 请更改为随机的密钥
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///japanese_study.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'connect_args': {
        'timeout': 30,
        'check_same_thread': False
    }
}

# 初始化数据库
db.init_app(app)

# 创建数据库表
with app.app_context():
    db.create_all()

# 登录验证装饰器
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            return redirect(url_for('index', active_tab='dashboard'))
        else:
            return render_template('login.html', error='ユーザー名またはパスワードが正しくありません')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if password != confirm_password:
            return render_template('register.html', error='パスワードが一致しません')
        
        if User.query.filter_by(username=username).first():
            return render_template('register.html', error='このユーザー名は既に使用されています')
        
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    active_tab = request.args.get('active_tab', 'dashboard')
    current_user = User.query.get(session['user_id'])
    return render_template('index.html', active_tab=active_tab, current_user=current_user)
# 保存阅读练习记录
def save_reading_record(user_id, content, scores):
    user = User.query.get(user_id)
    record = ReadingRecord(
        user_id=user_id,
        content=content,
        accuracy_score=scores.get('accuracy_score'),
        fluency_score=scores.get('fluency_score'),
        completeness_score=scores.get('completeness_score'),
        pronunciation_score=scores.get('pronunciation_score'),
        words_omitted=scores.get('words_omitted'),
        words_inserted=scores.get('words_inserted')
    )
    db.session.add(record)
    user.update_streak()
    db.session.commit()

# 保存话题练习记录
def save_topic_record(user_id, topic, response, scores):
    user = User.query.get(user_id)
    # 确保 feedback 是字符串
    if isinstance(scores.get('feedback'), list):
        feedback = '\n'.join(scores.get('feedback', []))
    else:
        feedback = str(scores.get('feedback', ''))

    # 确保 grammar_correction 是字符串
    grammar_correction = str(scores.get('grammar_correction', ''))

    record = TopicRecord(
        user_id=user_id,
        topic=topic,
        response=response,
        grammar_score=scores.get('grammar_score', 0),
        content_score=scores.get('content_score', 0),
        relevance_score=scores.get('relevance_score', 0),
        feedback=feedback,
        grammar_correction=grammar_correction
    )
    db.session.add(record)
    user.update_streak()
    db.session.commit()

@app.route("/ackaud", methods=["POST"])
@login_required
def ackaud():
    f = request.files['audio_data']
    reftext = request.form.get("reftext")
    #    f.save(audio)
    #print('file uploaded successfully')

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

    # 在获取评分结果后保存记录
    if response.ok:
        data = response.json()
        if data.get('RecognitionStatus') == 'Success':
            scores = data['NBest'][0]
            save_reading_record(
                user_id=session['user_id'],
                content=reftext,
                scores={
                    'accuracy_score': float(scores.get('AccuracyScore', 0)),
                    'fluency_score': float(scores.get('FluencyScore', 0)),
                    'completeness_score': float(scores.get('CompletenessScore', 0)),
                    'pronunciation_score': float(scores.get('PronScore', 0)),
                    'words_omitted': ','.join([w['Word'] for w in scores.get('Words', []) if w.get('ErrorType') == 'Omission']),
                    'words_inserted': ','.join([w['Word'] for w in scores.get('Words', []) if w.get('ErrorType') == 'Insertion'])
                }
            )
    
    return response.json()

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
    word = request.form.get("word")

    # Creates an instance of a speech config with specified subscription key and service region.
    speech_config = speechsdk.SpeechConfig(subscription=SUBSCRIPTION_KEY, region=REGION)
    speech_config.speech_synthesis_voice_name = VOICE

    # Creates a speech synthesizer with a null output stream.
    # This means the audio output data will not be written to any output channel.
    # You can just get the audio from the result.
    speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

    result = speech_synthesizer.speak_text_async(word).get()
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
        # response.headers['word'] = word
        return response
        
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation_details = result.cancellation_details
        print("Speech synthesis canceled: {}".format(cancellation_details.reason))
        if cancellation_details.reason == speechsdk.CancellationReason.Error:
            print("Error details: {}".format(cancellation_details.error_details))
        return jsonify({"success":False})

@app.route("/generate_text", methods=["POST"])
def generate_text():
    # 调用 Ollama 服务生成日语文本
    generated_text = generate_japanese_text()
    return jsonify({"text": generated_text})

# 配置 Gemini API
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
except Exception as e:
    logging.error(f"Gemini API 配置失败: {str(e)}")
    raise

def generate_japanese_text():
    """使用Google AI生成日语文本"""
    try:
        logging.info("开始使用Gemini API生成日语文本")
        
        # 配置生成参数
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 1024,
        }
        
        prompt = "50字程度の簡単な日本語の文章を書いてください。内容は日語学習者向けで、余計な説明や注釈を含めないでください。"
        
        # 生成内容
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        if not response or not response.text:
            error_msg = "Gemini API返回空响应"
            logging.error(error_msg)
            return "生成失败"
            
        logging.info("成功收到Gemini响应")
        return response.text.strip()
        
    except Exception as e:
        logging.error(f"调用Gemini API时出错: {str(e)}")
        return "生成失败"

@app.route("/generate_topic", methods=["POST"])
def generate_topic():
    """使用Google AI生成话题"""
    try:
        logging.info("开始使用Gemini API生成话题")
        
        # 配置生成参数
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 1024,
        }
        
        prompt = "日本語の会話練習のためのトピックを1つ提案してください。簡単な説明も付けてくさい。回答は100文字以内でお願いします。"
        
        # 生成内容
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        if not response or not response.text:
            logging.error("Gemini API返回空响应")
            return jsonify({"topic": "トピック生成に失敗しました"})
            
        logging.info("成功收到Gemini响应")
        return jsonify({"topic": response.text.strip()})
        
    except Exception as e:
        logging.error(f"调用Gemini API时出错: {str(e)}")
        return jsonify({"topic": "トピック生成に失敗しました"})

@app.route("/transcribe_audio", methods=["POST"])
@login_required
def transcribe_audio():
    logging.info("开始处理音频转写请求")
    
    if "audio" not in request.files:
        logging.error("请求中没有找到音频文件")
        return jsonify({"error": "音声ファイルが見つかりません"}), 400

    audio_file = request.files["audio"]
    topic = request.form.get('topic', '')
    current_user_id = session['user_id']  # 获取当前用户ID
    logging.info(f"接收到音频文件: {audio_file.filename}, Content-Type: {audio_file.content_type}")
    
    try:
        import os
        import subprocess
        
        # 保存临时webm文件
        temp_webm = "temp_audio.webm"
        audio_file.save(temp_webm)
        file_size = os.path.getsize(temp_webm)
        logging.info(f"临时webm文件已保存: {temp_webm}, 大小: {file_size} bytes")
        
        if file_size == 0:
            raise ValueError("録音ファイルが空です")
            
        # 使用ffmpeg将webm转换为wav
        temp_wav = "temp_audio.wav"
        logging.info("开始转换音频格式...")
        
        # 修改FFmpeg命令，添加更多参数
        ffmpeg_cmd = [
            'ffmpeg',
            '-y',  # 覆盖已存在的文件
            '-i', temp_webm,
            '-ar', '16000',  # 采样率
            '-ac', '1',      # 单声道
            '-acodec', 'pcm_s16le',  # 编码格式
            '-f', 'wav',     # 强制输出格式
            temp_wav
        ]
        
        logging.info(f"执行FFmpeg命令: {' '.join(ffmpeg_cmd)}")
        
        # 执行命令并捕获输出
        process = subprocess.Popen(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            error_message = stderr.decode() if stderr else "Unknown error"
            logging.error(f"FFmpeg转换失败: {error_message}")
            raise subprocess.CalledProcessError(process.returncode, ffmpeg_cmd, stderr)
            
        if not os.path.exists(temp_wav):
            raise FileNotFoundError("FFmpeg没有生成WAV文件")
            
        wav_size = os.path.getsize(temp_wav)
        logging.info(f"WAV文件已生成，大小: {wav_size} bytes")

        try:
            # 创建 Azure Speech 配置
            speech_config = speechsdk.SpeechConfig(subscription=SUBSCRIPTION_KEY, region=REGION)
            speech_config.speech_recognition_language = LANGUAGE

            # 创建音频配置
            audio_config = speechsdk.audio.AudioConfig(filename=temp_wav)

            # 创建语音识别器
            speech_recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
            logging.info("已创建Azure语音识别器")

            # 存储所有识别的文本
            all_results = []
            
            # 定义回调函数
            done = False
            def handle_result(evt):
                if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
                    all_results.append(evt.result.text)
                
            def handle_canceled(evt):
                if evt.result.reason == speechsdk.ResultReason.Canceled:
                    cancellation_details = evt.result.cancellation_details
                    logging.error(f"语音识别被取消: {cancellation_details.reason}")
                    if cancellation_details.reason == speechsdk.CancellationReason.Error:
                        logging.error(f"错误详情: {cancellation_details.error_details}")
                nonlocal done
                done = True

            # 绑定回调
            speech_recognizer.recognized.connect(handle_result)
            speech_recognizer.canceled.connect(handle_canceled)
            speech_recognizer.session_stopped.connect(lambda evt: setattr(done, True))

            # 开始连续识别
            logging.info("开始语音识别...")
            speech_recognizer.start_continuous_recognition()
            while not done:
                time.sleep(0.5)
            speech_recognizer.stop_continuous_recognition()

            # 合并所有识别结果
            transcribed_text = ' '.join(all_results)
            logging.info(f"Azure语音识别完成，结果: {transcribed_text}")

            # 启动异步任务进行分析
            from threading import Thread
            def analyze_text():
                with app.app_context():  # 确保在应用上下文中执行
                    try:
                        # 获取语法纠正和评分
                        grammar_feedback = get_grammar_feedback(transcribed_text)
                        topic_feedback = get_topic_feedback(transcribed_text, topic)
                        
                        # 保存记录
                        save_topic_record(
                            user_id=current_user_id,
                            topic=topic,
                            response=transcribed_text,
                            scores={
                                'grammar_score': topic_feedback.get('grammar_score', 0),
                                'content_score': topic_feedback.get('content_score', 0),
                                'relevance_score': topic_feedback.get('relevance_score', 0),
                                'feedback': topic_feedback.get('feedback', ''),
                                'grammar_correction': grammar_feedback
                            }
                        )
                        logging.info(f"成功保存用户 {current_user_id} 的练习记录")
                    except Exception as e:
                        logging.error(f"分析过程中出错: {str(e)}", exc_info=True)

            # 启动异步分析
            Thread(target=analyze_text).start()
            
            # 立即返回识别结果
            return jsonify({
                "text": transcribed_text,
                "status": "analyzing"
            })
                
        except Exception as e:
            error_msg = str(e)
            logging.error(f"Azure语音识别处理错误: {error_msg}", exc_info=True)
            return jsonify({"error": f"音声認識に失敗しました: {error_msg}"}), 500
        
    except ValueError as e:
        logging.error(f"输入验证错误: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode() if e.stderr else str(e)
        logging.error(f"FFmpeg错误: {error_msg}")
        return jsonify({"error": f"音声ファイルの変換に失敗しました: {error_msg}"}), 500
    except Exception as e:
        logging.error(f"处理过程中出现错误: {str(e)}", exc_info=True)
        return jsonify({"error": f"音声認識に失敗しました: {str(e)}"}), 500
    finally:
        # 确保临时文件被删除
        for temp_file in [temp_webm, temp_wav]:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                    logging.info(f"清理临时文件: {temp_file}")
            except Exception as e:
                logging.error(f"清理临时文件 {temp_file} 时出错: {str(e)}")

# 添加新的路由用于获取分析结果
@app.route("/get_analysis", methods=["POST"])
@login_required
def get_analysis():
    text = request.json.get('text')
    topic = request.json.get('topic')
    
    if not text:
        return jsonify({"error": "テキストが見つかりません"}), 400
        
    try:
        # 获取语法纠正和评分
        grammar_feedback = get_grammar_feedback(text)
        topic_feedback = get_topic_feedback(text, topic)
        
        return jsonify({
            "grammar_feedback": grammar_feedback,
            "topic_feedback": topic_feedback
        })
    except Exception as e:
        logging.error(f"获取分析结果时出错: {str(e)}", exc_info=True)
        return jsonify({"error": "分析に失敗しました"}), 500

def get_grammar_feedback(text):
    """使用Google AI获取语法纠正反馈"""
    try:
        logging.info("开始使用Gemini API进行语法分析")
        
        prompt = f"""以下の日本語文章を文法的に分析し、修正してください。
入力: {text}

以下の形式で回答してください：
1. 修正後の文章
2. 修正点の説明（箇条書き）

回答は日本語でお願いします。"""

        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 1024,
        }
        
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        if not response or not response.text:
            return "文法分析に失敗しました"
            
        return response.text.strip()
        
    except Exception as e:
        logging.error(f"Grammar feedback error: {e}")
        return "文法分析に失敗しました"

def get_topic_feedback(text, topic):
    """使用Google AI获取主题相关的反馈和评分"""
    try:
        logging.info(f"[Topic Feedback] 开始使用Gemini API评估回答 - Topic: {topic}, Answer: {text}")
        
        prompt = f"""以下の回答を評価してください。

トピック: {topic}
回答: {text}

以下の3つの観点から100点満点で評価し、改善点を具体的に指摘してください：

1. 文法の正確性 (grammar_score)：
   - 助詞の使用は適切か
   - 敬語の使用は正しいか
   - 時制は一貫しているか
   - 文の構造は正しいか

2. 内容の充実度 (content_score)：
   - 説明は具体的か
   - 例示は適切か
   - 論理的な構成になっているか
   - 内容は十分に展開されているか

3. トピックとの関連性 (relevance_score)：
   - トピックに適切に応答しているか
   - 主題から外れていないか
   - 文脈は一貫しているか
   - 要点を押さえているか

以下の形式で出力してください。他の説明は一切不要です。

{{
    "grammar_score": 評価点数,
    "content_score": 評価点数,
    "relevance_score": 評価点数,
    "feedback": "【改善点】\n1. 文法面：\n   - 具体的な指摘\n   - 具体的な指摘\n2. 内容面：\n   - 具体的な指摘\n   - 具体的な指摘\n3. 表現面：\n   - 具体的な指摘\n   - 具体的な指摘"
}}

注意事項：
- 数値は0-100の整数で記入し、実際の評価を反映させること
- feedbackは必ず"で囲む
- feedbackは必ず番号付きの箇条書きで記入
- 余計な説明は一切加えない
- 上記のJSONフォーマットを厳密に守る
- 「」『』などの日本語の記号は使わない
"""

        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 1024,
        }
        
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        if not response or not response.text:
            logging.error("[Topic Feedback] Gemini API返回空响应")
            raise ValueError("Empty response from Gemini API")
            
        feedback_text = response.text.strip()
        logging.info(f"[Topic Feedback] 收到原始响应：{feedback_text}")
        
        try:
            # 清理和规范化 JSON 字符串
            import re
            
            # 1. 提取 JSON 对象
            json_match = re.search(r'\{.*?\}', feedback_text, re.DOTALL)
            if not json_match:
                logging.error("[Topic Feedback] 未找到JSON对象")
                raise ValueError("JSON not found in response")
            
            json_str = json_match.group()
            logging.info(f"[Topic Feedback] 提取的JSON字符串：{json_str}")
            
            # 2. 清理JSON字符串
            json_str = re.sub(r'\s+', ' ', json_str).strip()
            json_str = re.sub(r'[「」『』【】、。，．]', '', json_str)
            
            # 3. 解析JSON
            result = json.loads(json_str)
            
            # 4. 验证和规范化结果
            for key in ["grammar_score", "content_score", "relevance_score"]:
                if key in result:
                    result[key] = max(0, min(100, int(result[key])))
                else:
                    result[key] = 0
                    
            if "feedback" not in result or not result["feedback"]:
                result["feedback"] = "評価を生成できませんでした"
            
            logging.info(f"[Topic Feedback] 最终结果：{result}")
            return result
            
        except (json.JSONDecodeError, ValueError) as e:
            logging.error(f"[Topic Feedback] 解析反馈时出错: {str(e)}")
            return {
                "grammar_score": 0,
                "content_score": 0,
                "relevance_score": 0,
                "feedback": "評価の解析に失敗しました"
            }
            
    except Exception as e:
        logging.error(f"[Topic Feedback] 获取反馈时出错: {str(e)}")
        return {
            "grammar_score": 0,
            "content_score": 0,
            "relevance_score": 0,
            "feedback": "評価の生成に失敗しました"
        }

@app.route("/api/reading/records")
@login_required
def get_reading_records():
    # 获取用户最近30天的阅读记录
    records = ReadingRecord.query.filter_by(user_id=session['user_id'])\
        .order_by(ReadingRecord.practice_date.desc())\
        .limit(30)\
        .all()
    
    return jsonify([{
        'date': record.practice_date.strftime('%Y-%m-%d'),
        'text': record.content[:50] + '...' if len(record.content) > 50 else record.content,
        'accuracy': record.accuracy_score,
        'fluency': record.fluency_score,
        'completeness': record.completeness_score,
        'pronunciation': record.pronunciation_score
    } for record in records])

@app.route("/api/topic/records")
@login_required
def get_topic_records():
    # 获取用户最近30天的Topic记录
    records = TopicRecord.query.filter_by(user_id=session['user_id'])\
        .order_by(TopicRecord.practice_date.desc())\
        .limit(30)\
        .all()
    
    return jsonify([{
        'date': record.practice_date.strftime('%Y-%m-%d'),
        'topic': record.topic,
        'answer': record.response,
        'grammar': record.grammar_score,
        'content': record.content_score,
        'relevance': record.relevance_score,
        'feedback': record.feedback,
        'grammar_correction': record.grammar_correction
    } for record in records])

@app.route("/api/reading/leaderboard")
@login_required
def get_reading_leaderboard():
    # 获取阅读练习的用户平均分排行榜
    leaderboard = db.session.query(
        User.username,
        db.func.avg(
            (ReadingRecord.accuracy_score + 
             ReadingRecord.fluency_score + 
             ReadingRecord.completeness_score + 
             ReadingRecord.pronunciation_score) / 4
        ).label('average_score')
    ).join(ReadingRecord, User.id == ReadingRecord.user_id)\
    .group_by(User.id)\
    .order_by(db.text('average_score DESC'))\
    .limit(10)\
    .all()
    
    return jsonify([{
        'username': username,
        'average_score': round(float(average_score), 2)
    } for username, average_score in leaderboard])

@app.route("/api/topic/leaderboard")
@login_required
def get_topic_leaderboard():
    # 获取Topic练习的用户平均分排行榜
    leaderboard = db.session.query(
        User.username,
        db.func.avg(
            (TopicRecord.grammar_score + 
             TopicRecord.content_score + 
             TopicRecord.relevance_score) / 3
        ).label('average_score')
    ).join(TopicRecord, User.id == TopicRecord.user_id)\
    .group_by(User.id)\
    .order_by(db.text('average_score DESC'))\
    .limit(10)\
    .all()
    
    return jsonify([{
        'username': username,
        'average_score': round(float(average_score), 2)
    } for username, average_score in leaderboard])

# 注册蓝图
app.register_blueprint(vocabulary_bp)
app.register_blueprint(forum_bp)

@app.route('/vocabulary')
@login_required
def vocabulary():
    current_user = User.query.get(session['user_id'])
    return render_template('vocabulary.html', 
                         active_tab='vocabulary', 
                         current_user=current_user)