import requests
import base64
import json
import time
import random
import azure.cognitiveservices.speech as speechsdk
import logging
from config import SUBSCRIPTION_KEY, REGION, LANGUAGE, VOICE

from flask import Flask, jsonify, render_template, request, make_response

app = Flask(__name__)

# 配置日志记录
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/readalong")
def readalong():
    return render_template("readalong.html")

@app.route("/topic")
def topic():
    return render_template("topic.html")

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
    prompt = f"""以下の日本語の回答を評価してください。

トピック: {topic}
回答: {text}

以下の形式で回答してください：
1. 文法の正確性（0-100点）
2. 内容の充実度（0-100点）
3. トピックとの関連性（0-100点）
4. 改善のためのアドバイス（箇条書き）

回答は以下のJSON形式で出力してください：
{{
    "grammar_score": 数値,
    "content_score": 数値,
    "relevance_score": 数値,
    "feedback": "アドバイス"
}}"""

    payload = {
        "model": "llama3.1:8b",
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        feedback_text = result.get("response", "")
        
        try:
            # 尝试直接解析返回的 JSON 字符串
            import re
            # 使用正则表达式提取 JSON 部分
            json_match = re.search(r'\{[^}]+\}', feedback_text)
            if json_match:
                feedback_json = json.loads(json_match.group())
                # 确保所有必要的字段都存在
                return {
                    "grammar_score": int(feedback_json.get("grammar_score", 0)),
                    "content_score": int(feedback_json.get("content_score", 0)),
                    "relevance_score": int(feedback_json.get("relevance_score", 0)),
                    "feedback": feedback_json.get("feedback", "評価を生成できませんでした")
                }
            else:
                # 如果无法找到 JSON，手动解析文本
                scores = re.findall(r'\d+', feedback_text)[:3]  # 提取前三个数字作为分数
                feedback = re.findall(r'アドバイス[：:](.*?)(?=\n|$)', feedback_text, re.DOTALL)
                
                return {
                    "grammar_score": int(scores[0]) if len(scores) > 0 else 0,
                    "content_score": int(scores[1]) if len(scores) > 1 else 0,
                    "relevance_score": int(scores[2]) if len(scores) > 2 else 0,
                    "feedback": feedback[0].strip() if feedback else "評価を生成できませんでした"
                }
        except (json.JSONDecodeError, ValueError, IndexError) as e:
            logging.error(f"Error parsing feedback: {str(e)}, raw text: {feedback_text}")
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