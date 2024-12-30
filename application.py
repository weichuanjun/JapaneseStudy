import requests
import base64
import json
import time
import random
import azure.cognitiveservices.speech as speechsdk
import logging
from config import SUBSCRIPTION_KEY, REGION, LANGUAGE, VOICE
from flask import Flask, jsonify, render_template, request, make_response, redirect, url_for, session, flash
from models import db, User, ReadingRecord, TopicRecord
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'  # 请更改为随机的密钥
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///japanese_study.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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

@app.route("/")
@login_required
def index():
    active_tab = request.args.get('active_tab', 'dashboard')
    return render_template("index.html", active_tab=active_tab)

# 保存阅读练习记录
def save_reading_record(user_id, content, scores):
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
    db.session.commit()

# 保存话题练习记录
def save_topic_record(user_id, topic, response, scores):
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

def generate_japanese_text():
    # Ollama 本地服务的 API 端点
    url = "http://localhost:11434/api/generate"  # 默认 Ollama 端口为 11434
    payload = {
        "model": "llama3.1:8b",  # 使用的模型名称，例如 llama3 或其他可用的模型
        "prompt": "200字程度の簡単な日本語の文章を書いてください。内容は日語学習者向けで、余計な説明や注釈を含めないでください。",
        "stream": False
    }

    try:
        logging.debug(f"Sending POST request to {url} with payload: {payload}")
        
        # 发送 POST 请求到 Ollama 服务
        response = requests.post(url, json=payload)
        
        # 记录响应状态码
        logging.debug(f"Received response with status code: {response.status_code}")
        
        response.raise_for_status()  # 检查请求是否成功

        # 解析生成的文本
        result = response.json()
        generated_text = result.get("response", "生成失败")  # 根据 Ollama API 返回的数据结构调整
        
        # 记录生成的文本
        logging.debug(f"Generated text: {generated_text}")

        return generated_text.strip()
    except requests.exceptions.RequestException as e:
        logging.error(f"Error calling Ollama service: {e}")
        return "生成失败"

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
@login_required
def transcribe_audio():
    logging.info("开始处理音频转写请求")
    
    if "audio" not in request.files:
        logging.error("请求中没有找到音频文件")
        return jsonify({"error": "音声ファイルが見つかりません"}), 400

    audio_file = request.files["audio"]
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
            raise ValueError("录音文件为空")
            
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

        # 使用whisper进行语音识别
        try:
            import sys
            logging.info(f"Python路径: {sys.path}")
            logging.info("尝试导入whisper...")
            
            from whisper import load_model
            logging.info("开始加载Whisper模型...")
            model = load_model("base")
            logging.info("Whisper模型加载成功，开始进行语音识别...")
            
            # 设置设备
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logging.info(f"使用设备: {device}")
            
            # 进行转写
            result = model.transcribe(
                temp_wav,
                language="ja",
                task="transcribe",
                fp16=False,  # 使用FP32以提高兼容性
                verbose=True  # 显示详细信息
            )
            
            transcribed_text = result["text"]
            logging.info(f"语音识别完成，结果: {transcribed_text}")
            
            # 获取语法纠正和评分
            grammar_feedback = get_grammar_feedback(transcribed_text)
            topic_feedback = get_topic_feedback(transcribed_text, request.form.get('topic', ''))
            
            # 在获取评分和反馈后保存记录
            topic = request.form.get('topic', '')
            if result and 'text' in result:
                save_topic_record(
                    user_id=session['user_id'],
                    topic=topic,
                    response=result['text'],
                    scores={
                        'grammar_score': topic_feedback.get('grammar_score', 0),
                        'content_score': topic_feedback.get('content_score', 0),
                        'relevance_score': topic_feedback.get('relevance_score', 0),
                        'feedback': topic_feedback.get('feedback', ''),
                        'grammar_correction': grammar_feedback
                    }
                )
            
            return jsonify({
                "text": transcribed_text,
                "grammar_feedback": grammar_feedback,
                "topic_feedback": topic_feedback
            })
            
        except ImportError as e:
            error_msg = f"Whisper导入错误: {str(e)}"
            logging.error(error_msg, exc_info=True)
            return jsonify({"error": f"音声認識の初期化に失敗しました: {error_msg}"}), 500
        except Exception as e:
            error_msg = str(e)
            logging.error(f"Whisper处理错误: {error_msg}", exc_info=True)
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
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        return result.get("response", "文法分析に失敗しました")
    except Exception as e:
        logging.error(f"Grammar feedback error: {e}")
        return "文法分析に失敗しました"

def get_topic_feedback(text, topic):
    """获取主题相关的反馈和评分"""
    url = "http://localhost:11434/api/generate"
    prompt = f"""以下の回答を評価してください。

トピック: {topic}
回答: {text}

以下の形式で出力してください。他の説明は一切不要です。

{{
    "grammar_score": 70,
    "content_score": 80,
    "relevance_score": 90,
    "feedback": "改善点をここに書いてください。"
}}

注意事項：
- 数値は0-100の整数で記入（例：70）
- feedbackは必ず"で囲む
- 改行は入れない
- 余計な説明は一切加えない
- 上記のJSONフォーマットを厳密に守る
- 「」『』【】などの日本語の記号は使わない"""

    payload = {
        "model": "llama3.1:8b",
        "prompt": prompt,
        "stream": False
    }

    try:
        logging.info(f"[Topic Feedback] 发送评分请求 - Topic: {topic}, Answer: {text}")
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        feedback_text = result.get("response", "")
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
            # 删除多余的空白和换行
            json_str = re.sub(r'\s+', ' ', json_str).strip()
            logging.info(f"[Topic Feedback] 清理空白后：{json_str}")
            
            # 替换所有日文引号和标点
            json_str = re.sub(r'[「」『』【】、。，．]', '', json_str)
            logging.info(f"[Topic Feedback] 清理日文标点后：{json_str}")
            
            # 3. 提取各个字段
            scores = {}
            for key in ['grammar_score', 'content_score', 'relevance_score']:
                match = re.search(rf'"{key}"\s*:\s*(\d+)', json_str)
                if match:
                    scores[key] = int(match.group(1))
                    logging.info(f"[Topic Feedback] 提取{key}: {scores[key]}")
            
            # 提取feedback
            feedback_match = re.search(r'"feedback"\s*:\s*"([^"]+)"', json_str)
            feedback = ""
            if feedback_match:
                feedback = feedback_match.group(1)
                # 移除所有引号和日文标点
                feedback = re.sub(r'[「」『』【】、。，．]', '', feedback)
                logging.info(f"[Topic Feedback] 提取feedback: {feedback}")
            
            # 4. 构建结果
            result = {
                "grammar_score": scores.get('grammar_score', 0),
                "content_score": scores.get('content_score', 0),
                "relevance_score": scores.get('relevance_score', 0),
                "feedback": feedback if feedback else "評価を生成できませんでした"
            }
            
            # 验证分数范围
            for key in ["grammar_score", "content_score", "relevance_score"]:
                result[key] = max(0, min(100, result[key]))
            
            logging.info(f"[Topic Feedback] 最终结果：{result}")
            return result
            
        except (json.JSONDecodeError, ValueError) as e:
            logging.error(f"[Topic Feedback] 解析反馈时出错: {str(e)}")
            logging.error(f"[Topic Feedback] 原始文本: {feedback_text}")
            
            # 尝试备用解析方法
            try:
                logging.info("[Topic Feedback] 尝试使用备用解析方法")
                # 提取分数
                scores = {}
                score_patterns = [
                    (r'grammar_score"?\s*:\s*(\d+)', 'grammar_score'),
                    (r'content_score"?\s*:\s*(\d+)', 'content_score'),
                    (r'relevance_score"?\s*:\s*(\d+)', 'relevance_score')
                ]
                
                for pattern, key in score_patterns:
                    match = re.search(pattern, feedback_text)
                    if match:
                        scores[key] = int(match.group(1))
                        logging.info(f"[Topic Feedback] 备用方法提取{key}: {scores[key]}")
                
                # 提取feedback
                feedback = ""
                feedback_patterns = [
                    r'feedback"?\s*:\s*"([^"]+)"',
                    r'改善点[：:]\s*(.+?)(?=\n|$)',
                    r'アドバイス[：:]\s*(.+?)(?=\n|$)'
                ]
                
                for pattern in feedback_patterns:
                    match = re.search(pattern, feedback_text, re.DOTALL)
                    if match:
                        feedback = match.group(1).strip()
                        # 移除所有引号和日文标点
                        feedback = re.sub(r'[「」『』【】、。，．]', '', feedback)
                        logging.info(f"[Topic Feedback] 备用方法提取feedback: {feedback}")
                        break
                
                result = {
                    "grammar_score": scores.get("grammar_score", 0),
                    "content_score": scores.get("content_score", 0),
                    "relevance_score": scores.get("relevance_score", 0),
                    "feedback": feedback if feedback else "評価を生成できませんでした"
                }
                
                # 验证分数范围
                for key in ["grammar_score", "content_score", "relevance_score"]:
                    result[key] = max(0, min(100, result[key]))
                
                logging.info(f"[Topic Feedback] 备用方法最终结果：{result}")
                return result
                
            except Exception as e2:
                logging.error(f"[Topic Feedback] 备用解析也失败: {str(e2)}")
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
        'topic': record.topic[:50] + '...' if len(record.topic) > 50 else record.topic,
        'grammar': record.grammar_score,
        'content': record.content_score,
        'relevance': record.relevance_score
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