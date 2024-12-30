var accuracyscore = document.getElementById('accuracyscore');
var fluencyscore = document.getElementById('fluencyscore');
var completenessscore = document.getElementById('completenessscore');
var pronscore = document.getElementById('pronscore');
var wordsomitted = document.getElementById('wordsomitted');
var wordsinserted = document.getElementById('wordsinserted');
var omittedwords = "";
var insertedwords = "";
wordsinserted.style.display = "none";
document.getElementById("wih").style.display = "none";

var wordrow = document.getElementById('wordrow');
var phonemerow = document.getElementById('phonemerow');
var scorerow = document.getElementById('scorerow');

var reftext = document.getElementById('reftext');
var formcontainer = document.getElementById('formcontainer');
var ttbutton = document.getElementById('randomtt');
var hbutton = document.getElementById('buttonhear');
var recordingsList = document.getElementById('recordingsList');
var ttsList = document.getElementById('ttsList');
var lastgettstext;
var objectUrlMain;
var wordaudiourls = new Array;

var phthreshold1 = 80;
var phthreshold2 = 60;
var phthreshold3 = 40;
var phthreshold4 = 20;

var AudioContext = window.AudioContext || window.webkitAudioContext;;
var audioContent;
var start = false;
var stop = false;
var permission = false;
var reftextval;
var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var audioStream; 					//MediaStreamAudioSourceNode we'll be recording
var blobpronun;
var offsetsarr;
var tflag = true;
var wordlist;

var t0 = 0;
var t1;
var at;

window.onload = () => {
    if (tflag) {
        tflag = gettoken();
        tflag = false;
    }

};

function gettoken() {
    var request = new XMLHttpRequest();
    request.open('POST', '/gettoken', true);

    // Callback function for when request completes
    request.onload = () => {
        // Extract JSON data from request
        const data = JSON.parse(request.responseText);
        at = data.at;
    }

    //send request
    request.send();
    return false;
}

function playword(k) {
    var audio = document.getElementById('ttsaudio');
    audio.playbackRate = 0.5;
    audio.currentTime = (offsetsarr[k] / 1000) + 0;

    var stopafter = 10000;

    if (k != offsetsarr.length - 1) {
        stopafter = (offsetsarr[k + 1] / 1000) + 0.01;
    }

    audio.play();

    var pausing_function = function () {
        if (this.currentTime >= stopafter) {
            this.pause();
            this.currentTime = 0;
            stopafter = 10000;
            // remove the event listener after you paused the playback
            this.removeEventListener("timeupdate", pausing_function);
            audio.playbackRate = 0.9;
        }
    };

    audio.addEventListener("timeupdate", pausing_function);

}

function playwordind(word) {
    var audio = document.getElementById('ttsaudio');
    audio.playbackRate = 0.5;

    for (var i = 0; i < wordaudiourls.length; i++) {
        if (wordaudiourls[i].word == word) {
            audio.src = wordaudiourls[i].objectUrl;
            audio.playbackRate = 0.7;
            audio.play();
            break;
        }
    }

    var ending_function = function () {
        audio.src = objectUrlMain;
        audio.playbackRate = 0.9;
        audio.autoplay = false;
        audio.removeEventListener("ended", ending_function);
    };

    audio.addEventListener("ended", ending_function);
}

reftext.onclick = function () { handleWordClick() };

function handleWordClick() {
    const activeTextarea = document.activeElement;
    var k = activeTextarea.selectionStart;

    reftextval = reftext.value;
    wordlist = reftextval.split(" ");

    var c = 0;
    var i = 0;
    for (i = 0; i < wordlist.length; i++) {
        c += wordlist[i].length;
        if (c >= k) {
            playwordind(wordlist[i]);
            //playword(i);
            break;
        }
        c += 1;
    }

}

var soundAllowed = function (stream) {
    permission = true;
    audioContent = new AudioContext();
    gumStream = stream;
    audioStream = audioContent.createMediaStreamSource(stream);
    rec = new Recorder(audioStream, { numChannels: 1 })

    //start the recording process
    rec.record()
}

var soundNotAllowed = function (error) {
    h.innerHTML = "You must allow your microphone.";
    console.log(error);
}

//function for onclick of hear pronunciation button
hbutton.onclick = function () {
    reftextval = reftext.value;

    if (reftextval != lastgettstext) {
        document.getElementById("ttsloader").style.display = "block";

        var request = new XMLHttpRequest();
        request.open('POST', '/gettts', true);
        request.responseType = "blob";

        // Callback function for when request completes
        request.onload = () => {
            var blobpronun = request.response;
            var offsets = request.getResponseHeader("offsets");
            offsetsarr = offsets.substring(1, offsets.length - 1).replace(/ /g, "").split(',').map(Number);;

            objectUrlMain = URL.createObjectURL(blobpronun);

            var au = document.createElement('audio');
            var li = document.createElement('p');

            //add controls to the <audio> element
            au.controls = true;
            au.autoplay = true;
            au.id = "ttsaudio"
            au.src = objectUrlMain;

            //add the new audio element to li
            li.appendChild(au);

            //add the li element to the ol

            if (ttsList.hasChildNodes()) {
                ttsList.lastChild.remove();
            }

            ttsList.appendChild(li);

            document.getElementById("ttsloader").style.display = "none";
        }
        const dat = new FormData();
        dat.append("reftext", reftextval);

        //send request
        request.send(dat);

        lastgettstext = reftextval;

        wordlist = reftextval.split(" ");
        for (var i = 0; i < wordlist.length; i++) {
            getttsforword(wordlist[i]);
        }

    }
    else {
        console.log("TTS Audio for given text already exists. You may change ref text");
    }

    return false;
}

function getttsforword(word) {
    var request = new XMLHttpRequest();
    request.open('POST', '/getttsforword', true);
    request.responseType = "blob";

    // Callback function for when request completes
    request.onload = () => {
        var blobpronun = request.response;
        var objectUrl = URL.createObjectURL(blobpronun);
        wordaudiourls.push({ word, objectUrl });
    }
    const dat = new FormData();
    dat.append("word", word);

    //send request
    request.send(dat);
}

//function for onclick of get tongue twister button
ttbutton.onclick = function () {
    var request = new XMLHttpRequest();
    request.open('POST', '/gettonguetwister', true);

    // Callback function for when request completes
    request.onload = () => {
        // Extract JSON data from request
        const data = JSON.parse(request.responseText);
        reftextval = data.tt;
        reftext.value = reftextval;
        reftext.innerText = reftextval;

    }

    //send request
    request.send();

    return false;
}

//function for handling main button clicks
document.getElementById('buttonmic').onclick = function () {
    if (reftext.value.length == 0) {
        alert("Reference Text cannot be empty!");
    } else {
        if (start) {
            // 停止录音
            start = false;
            this.innerHTML = "<span class='fa fa-microphone'></span>新しい録音";
            this.className = "green-button";
            rec.stop();

            // 停止麦克风
            gumStream.getAudioTracks()[0].stop();

            // 创建wav文件并处理
            rec.exportWAV(createDownloadLink);
        } else {
            // 清除之前的录音和评分
            if (recordingsList.hasChildNodes()) {
                recordingsList.innerHTML = '';
            }
            // 重置评分相关变量
            omittedwords = "";
            insertedwords = "";
            document.getElementById("wih").style.display = "none";
            wordsinserted.style.display = "none";
            wordsinserted.innerText = "";
            wordsomitted.innerText = "";

            // 重置评分表格
            document.getElementById("summarytable").style.display = "none";
            wordrow.innerHTML = '';
            phonemerow.innerHTML = '';
            scorerow.innerHTML = '';
            document.getElementById("detailedtable").style.display = "block";

            // 清除分数显示
            accuracyscore.innerText = "";
            fluencyscore.innerText = "";
            completenessscore.innerText = "";
            pronscore.innerText = "";

            // 开始新录音
            if (!permission) {
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(soundAllowed)
                    .catch(soundNotAllowed);
            } else {
                audioContent = new AudioContext();
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(function (stream) {
                        gumStream = stream;
                        audioStream = audioContent.createMediaStreamSource(stream);
                        rec = new Recorder(audioStream, { numChannels: 1 });
                        rec.record();
                    });
            }

            start = true;
            reftext.readonly = true;
            reftext.disabled = true;
            ttbutton.disabled = true;
            ttbutton.className = "btn";
            reftextval = reftext.value;

            this.innerHTML = "<span class='fa fa-stop'></span>Stop";
            this.className = "red-button";
        }
    }
};


function fillDetails(words) {
    for (var wi in words) {
        var w = words[wi];
        var countp = 0;

        if (w.ErrorType == "Omission") {
            omittedwords += w.Word;
            omittedwords += ', ';

            var tdda = document.createElement('td');
            tdda.innerText = '-';
            phonemerow.appendChild(tdda);

            var tddb = document.createElement('td');
            tddb.innerText = '-';
            scorerow.appendChild(tddb);

            var tdw = document.createElement('td');
            tdw.innerText = w.Word;
            tdw.style.backgroundColor = "orange";
            wordrow.appendChild(tdw);
        }
        else if (w.ErrorType == "Insertion") {
            insertedwords += w.Word;
            insertedwords += ', ';
        }
        else if (w.ErrorType == "None" || w.ErrorType == "Mispronunciation") {
            for (var phonei in w.Phonemes) {
                var p = w.Phonemes[phonei]

                var tdp = document.createElement('td');
                tdp.innerText = p.Phoneme;
                if (p.AccuracyScore >= phthreshold1) {
                    tdp.style.backgroundColor = "green";
                }
                else if (p.AccuracyScore >= phthreshold2) {
                    tdp.style.backgroundColor = "lightgreen";
                }
                else if (p.AccuracyScore >= phthreshold3) {
                    tdp.style.backgroundColor = "yellow";
                }
                else {
                    tdp.style.backgroundColor = "red";
                }
                phonemerow.appendChild(tdp);

                var tds = document.createElement('td');
                tds.innerText = p.AccuracyScore;
                scorerow.appendChild(tds);
                countp = Number(phonei) + 1;
            }
            var tdw = document.createElement('td');
            tdw.innerText = w.Word;
            var x = document.createElement("SUP");
            var t = document.createTextNode(w.AccuracyScore);
            x.appendChild(t);
            tdw.appendChild(x);
            tdw.colSpan = countp;
            if (w.ErrorType == "None") {
                tdw.style.backgroundColor = "lightgreen";
            }
            else {
                tdw.style.backgroundColor = "red";
            }
            wordrow.appendChild(tdw);
        }

    }
}

function fillData(data) {
    document.getElementById("summarytable").style.display = "flex";
    document.getElementById("detailedtable").style.display = "block";
    accuracyscore.innerText = data.AccuracyScore;
    fluencyscore.innerText = data.FluencyScore;
    completenessscore.innerText = data.CompletenessScore;
    pronscore.innerText = parseInt(data.PronScore, 10);

    // 重置表格内容
    wordrow.innerHTML = '';
    phonemerow.innerHTML = '';
    scorerow.innerHTML = '';

    fillDetails(data.Words);
    wordsomitted.innerText = omittedwords;
    if (insertedwords != "") {
        document.getElementById("wih").style.display = "block";
        wordsinserted.style.display = "block";
        wordsinserted.innerText = insertedwords;
    }
}

function createDownloadLink(blob) {
    var url = URL.createObjectURL(blob);
    var au = document.createElement('audio');
    var li = document.createElement('p');

    // Add controls to the <audio> element
    au.controls = true;
    au.src = url;

    // Add the new audio element to li
    li.appendChild(au);

    // Add the li element to the ol
    recordingsList.appendChild(li);

    // Send audio data to the backend
    var request = new XMLHttpRequest();
    request.open('POST', '/ackaud', true);

    request.onload = () => {
        const data = JSON.parse(request.responseText);
        if (data.RecognitionStatus == "Success") {
            fillData(data.NBest[0]);
        } else {
            alert("Did not catch audio properly! Please try again.");
        }
    };

    const data = new FormData();
    data.append("audio_data", blob, new Date().toISOString());
    data.append("reftext", reftextval);

    request.send(data);
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('generateText').addEventListener('click', function () {
        console.log("Generate button clicked");  // 调试信息

        // 添加呼吸效果
        this.classList.add('breathing-button');

        fetch('/generate_text', {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                console.log("Received data:", data);  // 调试信息
                document.getElementById('reftext').value = data.text;

                // 移除呼吸效果
                this.classList.remove('breathing-button');
            })
            .catch(error => {
                console.error('Error:', error);

                // 移除呼吸效果
                this.classList.remove('breathing-button');
            });
    });
});

// 标签页切换功能
document.addEventListener('DOMContentLoaded', function () {
    // 导航栏切换逻辑
    const navLinks = document.querySelectorAll('.nav-links a');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // 移除所有活动状态
            navLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));

            // 添加新的活动状态
            link.classList.add('active');
            const tabId = `${link.getAttribute('data-tab')}Tab`;
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Topic生成功能
    const generateTopicBtn = document.getElementById('generateTopic');
    generateTopicBtn.addEventListener('click', function () {
        this.classList.add('breathing-button');

        fetch('/generate_topic', {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                document.getElementById('topicText').value = data.topic;
                this.classList.remove('breathing-button');
            })
            .catch(error => {
                console.error('Error:', error);
                this.classList.remove('breathing-button');
            });
    });

    // Topic录音功能
    let topicRecorder;
    let topicStream;
    let isRecording = false;
    let topicChunks = [];

    const recordTopicBtn = document.getElementById('recordTopic');
    const transcribedText = document.getElementById('transcribedText');

    recordTopicBtn.addEventListener('click', function () {
        if (!isRecording) {
            // 清空之前的录音数据
            topicChunks = [];
            transcribedText.value = '';

            // 开始录音
            navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    sampleSize: 16,
                    volume: 1.0
                }
            })
                .then(stream => {
                    console.log("获取到音频流");
                    topicStream = stream;

                    // 尝试使用不同的音频格式
                    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                        ? 'audio/webm;codecs=opus'
                        : 'audio/webm';

                    console.log("使用的音频格式:", mimeType);

                    topicRecorder = new MediaRecorder(stream, {
                        mimeType: mimeType,
                        audioBitsPerSecond: 128000
                    });

                    console.log("创建MediaRecorder成功:", topicRecorder.state);

                    topicRecorder.ondataavailable = (e) => {
                        console.log("收到音频数据:", e.data.size, "bytes");
                        if (e.data.size > 0) {
                            topicChunks.push(e.data);
                        }
                    };

                    topicRecorder.onstop = () => {
                        console.log("录音停止，开始处理音频数据");
                        console.log("收集到的音频块数:", topicChunks.length);

                        if (topicChunks.length === 0) {
                            console.error("没有收集到音频数据");
                            transcribedText.value = "録音データがありません";
                            return;
                        }

                        // 创建音频blob
                        const audioBlob = new Blob(topicChunks, { type: mimeType });
                        console.log("创建的音频Blob大小:", audioBlob.size, "bytes");

                        if (audioBlob.size === 0) {
                            console.error("音频Blob为空");
                            transcribedText.value = "録音データが空です";
                            return;
                        }

                        // 创建FormData对象
                        const formData = new FormData();
                        formData.append('audio', audioBlob, 'recording.webm');
                        formData.append('topic', document.getElementById('topicText').value);

                        // 显示加载状态
                        transcribedText.value = '音声を認識しています...';
                        document.getElementById('grammarCorrection').value = '';
                        document.getElementById('feedbackText').value = '';
                        document.getElementById('grammarScore').textContent = '-';
                        document.getElementById('contentScore').textContent = '-';
                        document.getElementById('relevanceScore').textContent = '-';

                        // 发送到后端进行语音识别
                        console.log("开始发送音频数据到服务器");
                        fetch('/transcribe_audio', {
                            method: 'POST',
                            body: formData
                        })
                            .then(response => {
                                console.log("服务器响应状态:", response.status);
                                if (!response.ok) {
                                    return response.json().then(data => {
                                        throw new Error(data.error || '音声認識に失敗しました');
                                    });
                                }
                                return response.json();
                            })
                            .then(data => {
                                console.log("收到识别结果:", data);
                                if (data.error) {
                                    transcribedText.value = `音声認識に失敗しました: ${data.error}`;
                                } else {
                                    // 显示识别文本
                                    transcribedText.value = data.text || '音声を検出できませんでした';

                                    // 显示语法纠正
                                    document.getElementById('grammarCorrection').value = data.grammar_feedback || '';

                                    // 显示评分和反馈
                                    if (data.topic_feedback) {
                                        document.getElementById('grammarScore').textContent =
                                            data.topic_feedback.grammar_score || '-';
                                        document.getElementById('contentScore').textContent =
                                            data.topic_feedback.content_score || '-';
                                        document.getElementById('relevanceScore').textContent =
                                            data.topic_feedback.relevance_score || '-';
                                        document.getElementById('feedbackText').value =
                                            data.topic_feedback.feedback || '';
                                    }
                                }
                            })
                            .catch(error => {
                                console.error('音声認識エラー:', error);
                                transcribedText.value = error.message || '音声認識に失敗しました';
                            });
                    };

                    // 每500毫秒收集一次数据
                    topicRecorder.start(500);
                    console.log("开始录音");
                    isRecording = true;
                    this.innerHTML = "<span class='fa fa-stop'></span>停止";
                    this.className = "red-button";
                })
                .catch(error => {
                    console.error('マイクアクセスエラー:', error);
                    alert('マイクへのアクセスに失敗しました: ' + error.message);
                });
        } else {
            // 停止录音
            console.log("停止录音");
            topicRecorder.stop();
            topicStream.getTracks().forEach(track => track.stop());
            isRecording = false;
            this.innerHTML = "<span class='fa fa-microphone'></span>録音";
            this.className = "green-button";
        }
    });
});