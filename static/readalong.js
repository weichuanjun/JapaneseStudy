var authorizationToken;
var start = false;
var stopf = false;

function gettoken() {
    var request = new XMLHttpRequest();
    request.open('POST', '/gettoken', true);

    // Callback function for when request completes
    request.onload = () => {
        // Extract JSON data from request
        const data = JSON.parse(request.responseText);
        authorizationToken = data.at;
    }

    //send request
    request.send();
    return false;
}

var textdone, textleft;
var totalscore = 0;
var totalscorep;
var pointsdiv;
var authorizationToken, phrases;
var region = "centralindia";
var language = "en-IN";
var SpeechSDK;
var recognizer;
var id = 0;
var storyi = 0;
var story;
var cursentence = "";
var cursentencewordsleft = [];
var cursentencewordsdone = [];
var nomatchflag = 0;

var reco;
var buttonmic;

var soundContext = undefined;
try {
    var AudioContext = window.AudioContext // our preferred impl
        || window.webkitAudioContext       // fallback, mostly when on Safari
        || false;                          // could not find.

    if (AudioContext) {
        soundContext = new AudioContext();
    } else {
        alert("Audio context not supported");
    }
}
catch (e) {
    window.console.log("no sound context found, no audio output. " + e);
}

function initvars() {
    authorizationToken = "";
    phrases = [];
    region = "centralindia";
    language = "en-IN";
    recognizer = undefined;
    start = false;
    stopf = false;
    storyi = 0;
    story = "";
    cursentence = "";
    cursentencewordsleft = [];
    cursentencewordsdone = [];
    nomatchflag = 0;
    reco = undefined;

    soundContext = undefined;
    try {
        var AudioContext = window.AudioContext // our preferred impl
            || window.webkitAudioContext       // fallback, mostly when on Safari
            || false;                          // could not find.

        if (AudioContext) {
            soundContext = new AudioContext();
        } else {
            alert("Audio context not supported");
        }
    }
    catch (e) {
        window.console.log("no sound context found, no audio output. " + e);
    }
}

function getstory(id) {
    console.log("getting story " + id.toString());
    var request = new XMLHttpRequest();
    request.open('POST', '/getstory', true);

    // Callback function for when request completes
    request.onload = () => {
        const data = JSON.parse(request.responseText);
        //console.log(data);
        if (data.code == 200) {
            story = data.story;
            //console.log(story);
            document.getElementById("textleft").innerHTML = story[0];
            document.getElementById("textdone").innerHTML = "";
        }
        else {
            console.log("You have completed all stories");
            document.getElementById("textleft").innerHTML = "--- THE END ---";
        }
    }
    // Add data to send with request
    const data = new FormData();
    data.append("id", id);

    //send request
    request.send(data);

    return false;
}
getstory(id);

document.addEventListener("DOMContentLoaded", function () {
    buttonmic = document.getElementById("buttonmic");
    textdone = document.getElementById("textdone");
    textleft = document.getElementById("textleft");
    pointsdiv = document.getElementById("pointsdiv");
    totalscorep = document.getElementById("totalscorep");

    function score(points) {
        totalscore += points;
        var newpoint = document.createElement("p");
        newpoint.innerHTML = (points >= 0) ? "+" + points.toString() : points.toString();
        newpoint.className = "points";
        if (pointsdiv.childElementCount >= 5) {
            pointsdiv.removeChild(pointsdiv.childNodes[0]);
        }
        pointsdiv.appendChild(newpoint);
        totalscorep.innerHTML = totalscore.toString();

    }

    function getnextsentence() {
        console.log("getnextsentence");
        if (storyi < story.length) {
            cursentence = story[storyi];
            textleft.innerHTML = cursentence;
            textdone.innerHTML = "";
            storyi++;
            cursentencewordsleft = cursentence.split(" ");
            cursentencewordsdone = [];
        }
    }

    function match(word) {
        if (word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"'?!]/g, "") == cursentencewordsleft[0].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"'?!]/g, "")) {
            cursentencewordsdone.push(cursentencewordsleft.shift());
            console.log("MATCH = " + word);
            textdone.innerHTML = cursentencewordsdone.join(" ") + " ";
            textleft.innerHTML = cursentencewordsleft.join(" ");
            score(2);
        }
        else if (nomatchflag > 0) {
            if (word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"'?!]/g, "") == cursentencewordsleft[1].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"'?!]/g, "")) {
                console.log("GOT A SKIP AND MATCH for " + word + " at nomatchflag =" + nomatchflag.toString());
                nomatchflag = 0;
                cursentencewordsdone.push(cursentencewordsleft.shift());
                cursentencewordsdone.push(cursentencewordsleft.shift());
                textdone.innerHTML = cursentencewordsdone.join(" ") + " ";
                textleft.innerHTML = cursentencewordsleft.join(" ");
                score(1);
            }
            else {
                console.log("SKIP BUT NO MATCH!");
            }
        }
        else {
            nomatchflag = 1;
            score(-1);
            console.log("NOMATCH for " + cursentencewordsleft[0].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"'?!]/g, "").italics() + ". Instead, received " + word.italics());
            console.log(cursentencewordsleft);
            console.log(cursentencewordsdone);
            console.log("NOMATCH END -----------------");
        }

        if (cursentencewordsleft.length == 0) {
            if (storyi < story.length) {
                getnextsentence()
            }
            else {
                console.log("FINISHED STORY");
                stoppingfunction();
            }
        }
    }

    function stoppingfunction() {
        start = false;
        stopf = true;
        buttonmic.innerHTML = "<span class='fa fa-step-forward'></span>Next";
        buttonmic.className = "blue-button";
        reco.stopContinuousRecognitionAsync(
            function () {
                reco.close();
                reco = undefined;
            },
            function (err) {
                reco.close();
                reco = undefined;
            });
    }

    // 初始化变量
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // 初始化语音识别
    function initializeSpeechRecognition() {
        if (!authorizationToken) {
            console.error('Authorization token not available');
            return;
        }

        try {
            const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(authorizationToken, region);
            speechConfig.speechRecognitionLanguage = "ja-JP";

            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

            recognizer.recognized = function (s, e) {
                if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                    processRecognizedText(e.result.text);
                }
            };

            recognizer.recognizing = function (s, e) {
                if (e.result.text) {
                    updateCurrentRecognition(e.result.text);
                }
            };

            recognizer.canceled = function (s, e) {
                if (e.reason === SpeechSDK.CancellationReason.Error) {
                    console.error('Recognition error:', e.errorDetails);
                    restartRecognition();
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

            mediaRecorder.start(1000); // 每秒收集一次数据
            isRecording = true;

            // 同时启动语音识别
            if (recognizer) {
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
        formData.append('reftext', document.getElementById('reftext').value);

        try {
            const response = await fetch('/ackaud', {
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
        if (!data || !data.NBest || data.NBest.length === 0) {
            alert('評価結果を取得できませんでした。');
            return;
        }

        const result = data.NBest[0];

        // 更新分数显示
        document.getElementById('accuracyscore').textContent = result.AccuracyScore.toFixed(1);
        document.getElementById('fluencyscore').textContent = result.FluencyScore.toFixed(1);
        document.getElementById('completenessscore').textContent = result.CompletenessScore.toFixed(1);
        document.getElementById('pronscore').textContent = result.PronScore.toFixed(1);

        // 显示详细评分
        const wordrow = document.getElementById('wordrow');
        const phonemerow = document.getElementById('phonemerow');
        const scorerow = document.getElementById('scorerow');

        wordrow.innerHTML = '';
        phonemerow.innerHTML = '';
        scorerow.innerHTML = '';

        if (result.Words) {
            result.Words.forEach(word => {
                // 添加单词行
                const wordCell = document.createElement('td');
                wordCell.textContent = word.Word;
                wordCell.style.backgroundColor = word.ErrorType === 'None' ? 'lightgreen' : 'red';
                wordrow.appendChild(wordCell);

                // 添加音素和分数
                if (word.Phonemes) {
                    word.Phonemes.forEach(phoneme => {
                        const phonemeCell = document.createElement('td');
                        phonemeCell.textContent = phoneme.Phoneme;
                        phonemerow.appendChild(phonemeCell);

                        const scoreCell = document.createElement('td');
                        scoreCell.textContent = phoneme.AccuracyScore.toFixed(1);
                        scorerow.appendChild(scoreCell);
                    });
                }
            });
        }

        // 显示评分区域
        document.getElementById('metrics').style.display = 'block';
    }

    // 录音按钮事件处理
    document.getElementById('buttonmic').addEventListener('click', function () {
        if (!document.getElementById('reftext').value.trim()) {
            alert('参照テキストを入力してください。');
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

    function Initialize(onComplete) {
        if (!!window.SpeechSDK) {
            document.getElementById('warning').style.display = 'none';
            onComplete(window.SpeechSDK);
        }
    }

    Initialize(function (speechSdk) {
        SpeechSDK = speechSdk;

        // in case we have a function for getting an authorization token, call it.
        if (typeof gettoken === "function") {
            gettoken();
            //console.log("got access token");
        }
    });
});