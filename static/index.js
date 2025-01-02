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
    gumStream = stream;
    audioContent = new AudioContext();
    audioStream = audioContent.createMediaStreamSource(stream);
    rec = new Recorder(audioStream, { numChannels: 1 });
    rec.record();

    // 更新按钮状态
    start = true;
    document.getElementById('buttonmic').innerHTML = "<span class='fa fa-stop'></span>停止";
    document.getElementById('buttonmic').className = "red-button";
}

var soundNotAllowed = function (error) {
    console.log('Error getting audio stream:', error);
    alert('Error getting audio stream: ' + error.message);
}

//function for onclick of hear pronunciation button
hbutton.onclick = function () {
    reftextval = reftext.value;

    if (reftextval != lastgettstext) {
        document.getElementById("ttsloader").style.display = "block";
        document.getElementById("ttscont").classList.add('show');
        document.getElementById("ttsList").classList.add('show');

        var request = new XMLHttpRequest();
        request.open('POST', '/gettts', true);
        request.responseType = "blob";

        // Callback function for when request completes
        request.onload = () => {
            var blobpronun = request.response;
            var offsets = request.getResponseHeader("offsets");
            offsetsarr = offsets.substring(1, offsets.length - 1).replace(/ /g, "").split(',').map(Number);;

            objectUrlMain = URL.createObjectURL(blobpronun);

            var container = document.createElement('div');
            container.className = 'audio-container';

            var label = document.createElement('span');
            label.className = 'audio-label';
            label.textContent = '正しい発音';

            var au = document.createElement('audio');
            au.className = 'audio-player';
            au.controls = true;
            au.autoplay = true;
            au.id = "ttsaudio";
            au.src = objectUrlMain;

            container.appendChild(label);
            container.appendChild(au);

            if (ttsList.hasChildNodes()) {
                ttsList.lastChild.remove();
            }

            ttsList.appendChild(container);

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
        document.getElementById("ttscont").classList.add('show');
        document.getElementById("ttsList").classList.add('show');
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
        return;
    }

    if (start) {
        // 停止录音
        start = false;
        this.innerHTML = "<span class='fa fa-microphone'></span>新しい録音";
        this.className = "green-button";

        if (rec) {
            rec.stop();
            // 停止麦克风
            if (gumStream) {
                gumStream.getAudioTracks()[0].stop();
            }
            // 创建wav文件并处理
            rec.exportWAV(createDownloadLink);
        }
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
        document.getElementById("summarytable").classList.remove('show');
        wordrow.innerHTML = '';
        phonemerow.innerHTML = '';
        scorerow.innerHTML = '';
        document.getElementById("detailedtable").classList.remove('show');

        // 清除分数显示
        accuracyscore.innerText = "";
        fluencyscore.innerText = "";
        completenessscore.innerText = "";
        pronscore.innerText = "";

        // 显示录音相关组件
        document.getElementById("recordcont").classList.add('show');
        document.getElementById("recordingsList").classList.add('show');

        // 开始新录音
        if (!permission) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(soundAllowed)
                .catch(soundNotAllowed);
        } else {
            gumStream = null;
            audioContent = new AudioContext();
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(soundAllowed)
                .catch(soundNotAllowed);
        }
    }
}


function fillDetails(words) {
    // 创建表格容器
    var tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';

    for (var wi in words) {
        var w = words[wi];

        if (w.ErrorType == "Omission") {
            omittedwords += w.Word;
            omittedwords += ', ';

            // 创建单词单元
            var unit = document.createElement('div');
            unit.className = 'word-unit';

            var wordCell = document.createElement('div');
            wordCell.className = 'word-cell';
            // 只取第一个斜杠前的内容
            wordCell.innerText = w.Word.split('/')[0];
            wordCell.style.backgroundColor = "orange"; // CSS会自动覆盖这个颜色

            var scoreCell = document.createElement('div');
            scoreCell.className = 'score-cell';
            scoreCell.innerText = '-';

            unit.appendChild(wordCell);
            unit.appendChild(scoreCell);
            tableContainer.appendChild(unit);
        }
        else if (w.ErrorType == "Insertion") {
            insertedwords += w.Word;
            insertedwords += ', ';
        }
        else if (w.ErrorType == "None" || w.ErrorType == "Mispronunciation") {
            // 创建单词单元
            var unit = document.createElement('div');
            unit.className = 'word-unit';

            var wordCell = document.createElement('div');
            wordCell.className = 'word-cell';
            // 只取第一个斜杠前的内容
            wordCell.innerText = w.Word.split('/')[0];

            if (w.ErrorType == "None") {
                wordCell.style.backgroundColor = "lightgreen"; // CSS会自动覆盖这个颜色
            } else {
                wordCell.style.backgroundColor = "red"; // CSS会自动覆盖这个颜色
            }

            var scoreCell = document.createElement('div');
            scoreCell.className = 'score-cell';
            scoreCell.innerText = w.AccuracyScore;

            unit.appendChild(wordCell);
            unit.appendChild(scoreCell);
            tableContainer.appendChild(unit);
        }
    }

    // 清空并添加新内容
    wordrow.innerHTML = '';
    scorerow.innerHTML = '';
    wordrow.appendChild(tableContainer);
}

function fillData(data) {
    document.getElementById("summarytable").classList.add('show');
    document.getElementById("detailedtable").classList.add('show');
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
    reftextval = reftext.value;
    var url = URL.createObjectURL(blob);
    const selectedDifficulty = document.querySelector('.difficulty-btn.active').dataset.difficulty;

    var container = document.createElement('div');
    container.className = 'audio-container';

    var label = document.createElement('span');
    label.className = 'audio-label';
    label.textContent = 'あなたの発音';

    var au = document.createElement('audio');
    au.className = 'audio-player';
    au.controls = true;
    au.src = url;

    container.appendChild(label);
    container.appendChild(au);

    recordingsList.appendChild(container);
    document.getElementById("recordingsList").style.display = "block";

    var loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.id = 'resultLoading';
    loadingDiv.textContent = '採点中';
    recordingsList.appendChild(loadingDiv);

    var request = new XMLHttpRequest();
    request.open('POST', '/ackaud', true);

    request.onload = () => {
        const loadingElement = document.getElementById('resultLoading');
        if (loadingElement) {
            loadingElement.remove();
        }

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
    data.append("difficulty", selectedDifficulty);

    request.send(data);
}

document.addEventListener('DOMContentLoaded', function () {
    // 难度选择按钮处理
    const difficultyBtns = document.querySelectorAll('.difficulty-btn');
    let selectedDifficulty = 'medium'; // 默认中等难度

    if (difficultyBtns) {
        difficultyBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                // 移除所有按钮的激活状态
                difficultyBtns.forEach(b => b.classList.remove('active'));
                // 激活当前按钮
                this.classList.add('active');
                // 更新选中的难度
                selectedDifficulty = this.dataset.difficulty;
            });
        });

        // 默认激活中等难度按钮
        document.querySelector('[data-difficulty="medium"]').classList.add('active');
    }

    document.getElementById('generateText').addEventListener('click', function () {
        console.log("Generate button clicked");
        this.classList.add('breathing-button');

        fetch('/generate_text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ difficulty: selectedDifficulty })
        })
            .then(response => response.json())
            .then(data => {
                console.log("Received data:", data);
                document.getElementById('reftext').value = data.text;
                this.classList.remove('breathing-button');
            })
            .catch(error => {
                console.error('Error:', error);
                this.classList.remove('breathing-button');
            });
    });

    // 标签页切换功能
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
    const recordTopicBtn = document.getElementById('recordTopic');
    const transcribedText = document.getElementById('transcribedText');

    let topicRecorder;
    let topicStream;
    let isRecording = false;
    let topicChunks = [];

    if (generateTopicBtn) {
        generateTopicBtn.addEventListener('click', function () {
            // 显示加载状态
            const topicText = document.getElementById('topicText');
            topicText.value = 'トピックを生成中...';
            this.classList.add('breathing-button');

            fetch('/generate_topic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ difficulty: selectedDifficulty })
            })
                .then(response => response.json())
                .then(data => {
                    document.getElementById('topicText').value = data.topic;
                    this.classList.remove('breathing-button');
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('topicText').value = 'トピック生成に失敗しました';
                    this.classList.remove('breathing-button');
                });
        });
    }

    if (recordTopicBtn) {
        recordTopicBtn.addEventListener('click', function () {
            if (!isRecording) {
                // 清空之前的录音数据
                topicChunks = [];
                transcribedText.value = '';
                document.getElementById('feedbackText').value = '';
                document.getElementById('grammarScore').textContent = '-';
                document.getElementById('contentScore').textContent = '-';
                document.getElementById('relevanceScore').textContent = '-';

                // 开始录音
                navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        sampleRate: 16000
                    }
                })
                    .then(stream => {
                        console.log("获取到音频流");
                        topicStream = stream;
                        const options = {
                            audioBitsPerSecond: 128000,
                            mimeType: 'audio/webm'
                        };

                        topicRecorder = new MediaRecorder(stream, options);
                        console.log("创建MediaRecorder成功:", topicRecorder.state);

                        topicRecorder.ondataavailable = (e) => {
                            console.log("收到音频数据:", e.data.size, "bytes");
                            if (e.data.size > 0) {
                                topicChunks.push(e.data);
                            }
                        };

                        topicRecorder.onstop = async () => {
                            console.log("录音停止，开始处理音频数据");
                            if (topicChunks.length === 0) {
                                console.error("没有收集到音频数据");
                                transcribedText.value = "録音データがありません";
                                return;
                            }

                            const audioBlob = new Blob(topicChunks, { type: 'audio/webm' });
                            console.log("创建的音频Blob大小:", audioBlob.size, "bytes");

                            const selectedDifficulty = document.querySelector('.difficulty-btn.active').dataset.difficulty;

                            const formData = new FormData();
                            formData.append('audio', audioBlob, 'recording.webm');
                            formData.append('topic', document.getElementById('topicText').value);
                            formData.append('difficulty', selectedDifficulty);

                            transcribedText.value = '音声を認識しています...';

                            try {
                                // 发送音频进行识别
                                const response = await fetch('/transcribe_audio', {
                                    method: 'POST',
                                    body: formData
                                });

                                if (!response.ok) {
                                    throw new Error('音声認識に失敗しました');
                                }

                                const data = await response.json();
                                console.log("收到识别结果:", data);

                                if (data.error) {
                                    transcribedText.value = `エラー: ${data.error}`;
                                    return;
                                }

                                // 显示识别文本
                                transcribedText.value = data.text || '音声を検出できませんでした';

                                // 如果状态是analyzing，等待一会儿后获取分析结果
                                if (data.status === 'analyzing' && data.text) {
                                    setTimeout(async () => {
                                        try {
                                            const analysisResponse = await fetch('/get_analysis', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                },
                                                body: JSON.stringify({
                                                    text: data.text,
                                                    topic: document.getElementById('topicText').value
                                                })
                                            });

                                            if (!analysisResponse.ok) {
                                                throw new Error('分析に失敗しました');
                                            }

                                            const analysisData = await analysisResponse.json();
                                            console.log("收到分析结果:", analysisData);

                                            // 更新界面显示
                                            document.getElementById('grammarScore').textContent =
                                                analysisData.grammar_score || '-';
                                            document.getElementById('contentScore').textContent =
                                                analysisData.content_score || '-';
                                            document.getElementById('relevanceScore').textContent =
                                                analysisData.relevance_score || '-';
                                            document.getElementById('feedbackText').value =
                                                analysisData.feedback || '';

                                        } catch (error) {
                                            console.error('Analysis error:', error);
                                            document.getElementById('feedbackText').value =
                                                'フィードバックの取得に失敗しました';
                                        }
                                    }, 2000); // 等待2秒后获取分析结果
                                }
                            } catch (error) {
                                console.error('Error:', error);
                                transcribedText.value = error.message || '音声認識に失敗しました';
                            }
                        };

                        // 开始录音
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
                if (topicRecorder && topicRecorder.state === 'recording') {
                    topicRecorder.stop();
                }
                if (topicStream) {
                    topicStream.getTracks().forEach(track => track.stop());
                }
                isRecording = false;
                this.innerHTML = "<span class='fa fa-microphone'></span>録音";
                this.className = "green-button";
            }
        });
    }
});

// 在获取评分结果时
function showResults(data) {
    document.getElementById('summarytable').classList.add('show');
    document.getElementById('detailedtable').classList.add('show');
    // ... 其他代码 ...
}

// 在需要隐藏组件时
function hideComponents() {
    document.getElementById('ttscont').classList.remove('show');
    document.getElementById('recordcont').classList.remove('show');
    document.getElementById('summarytable').classList.remove('show');
    document.getElementById('detailedtable').classList.remove('show');
}

async function analyzeTopic(text, topic) {
    try {
        const response = await fetch('/analyze_topic', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, topic })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // 更新分数显示
        document.getElementById('grammarScore').textContent = data.grammar_score;
        document.getElementById('contentScore').textContent = data.content_score;
        document.getElementById('relevanceScore').textContent = data.relevance_score;

        // 更新反馈文本
        document.getElementById('feedbackText').value = data.feedback;

    } catch (error) {
        console.error('Error:', error);
        alert('分析中にエラーが発生しました。');
    }
}

// 当录音完成并获得文本后调用此函数
function handleTranscriptionComplete(text, topic) {
    document.getElementById('transcribedText').value = text;
    analyzeTopic(text, topic);
}