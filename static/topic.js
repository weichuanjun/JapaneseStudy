// 初始化变量
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recognizer = null;

// 初始化语音识别
async function initializeSpeechRecognition() {
    try {
        const response = await fetch('/get_token');
        if (!response.ok) {
            throw new Error('Failed to get token');
        }
        const data = await response.json();

        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(data.token, data.region);
        speechConfig.speechRecognitionLanguage = "ja-JP";

        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        recognizer.recognized = function (s, e) {
            if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                const transcribedText = document.getElementById('transcribedText');
                transcribedText.value += e.result.text + ' ';
            }
        };

        recognizer.recognizing = function (s, e) {
            if (e.result.text) {
                const currentText = document.getElementById('currentText');
                currentText.textContent = e.result.text;
            }
        };

        recognizer.canceled = function (s, e) {
            if (e.reason === SpeechSDK.CancellationReason.Error) {
                console.error('Recognition error:', e.errorDetails);
                alert('音声認識にエラーが発生しました。');
            }
        };

    } catch (error) {
        console.error('Error initializing speech recognition:', error);
        alert('音声認識の初期化に失敗しました。');
    }
}

// 开始录音
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await processAudioData(audioBlob);
        };

        mediaRecorder.start(1000);
        isRecording = true;

        // 同时启动语音识别
        if (recognizer) {
            recognizer.startContinuousRecognitionAsync();
        } else {
            await initializeSpeechRecognition();
            recognizer.startContinuousRecognitionAsync();
        }
    } catch (error) {
        console.error('Error starting recording:', error);
        alert('マイクの使用が許可されていません。');
    }
}

// 停止录音
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync();
    }

    isRecording = false;
}

// 处理录音数据
async function processAudioData(audioBlob) {
    const formData = new FormData();
    formData.append('audio_data', audioBlob);
    formData.append('topic', document.getElementById('topicText').value);

    try {
        const response = await fetch('/process_topic_speech', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Server response was not ok');
        }

        const result = await response.json();
        displayResults(result);
    } catch (error) {
        console.error('Error processing audio:', error);
        alert('音声の処理に失敗しました。');
    }
}

// 显示结果
function displayResults(data) {
    if (!data) {
        alert('評価結果を取得できませんでした。');
        return;
    }

    // 更新分数显示
    document.getElementById('pronunciationScore').textContent = data.pronunciation_score.toFixed(1);
    document.getElementById('fluencyScore').textContent = data.fluency_score.toFixed(1);
    document.getElementById('grammarScore').textContent = data.grammar_score.toFixed(1);

    // 显示语法纠正和反馈
    const grammarCorrection = document.getElementById('grammarCorrection');
    const feedbackText = document.getElementById('feedbackText');

    if (data.grammar_correction) {
        grammarCorrection.value = data.grammar_correction;
    }

    if (data.feedback) {
        feedbackText.value = data.feedback;
    }

    // 显示评分区域
    document.getElementById('results').style.display = 'block';
}

// 录音按钮事件处理
document.getElementById('recordButton').addEventListener('click', function () {
    if (!document.getElementById('topicText').value.trim()) {
        alert('先にトピックを生成してください。');
        return;
    }

    if (!isRecording) {
        this.innerHTML = '<span class="fa fa-stop"></span>停止';
        this.className = 'red-button';
        startRecording();
    } else {
        this.innerHTML = '<span class="fa fa-microphone"></span>新しい録音';
        this.className = 'green-button';
        stopRecording();
    }
}); 