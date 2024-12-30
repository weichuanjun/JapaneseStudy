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

var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContent;
var start = false;
var stop = false;
var permission = false;
var reftextval;
var gumStream;
var rec;
var audioStream;
var blobpronun;
var offsetsarr;
var tflag = true;
var wordlist;

var t0 = 0;
var t1;
var at;

// 初始化
window.onload = () => {
    if (tflag) {
        tflag = gettoken();
        tflag = false;
    }
    initScoreChart();
};

// 获取token
function gettoken() {
    var request = new XMLHttpRequest();
    request.open('POST', '/gettoken', true);
    request.onload = () => {
        const data = JSON.parse(request.responseText);
        at = data.at;
    }
    request.send();
    return false;
}

// 播放单词音频
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
            this.removeEventListener("timeupdate", pausing_function);
            audio.playbackRate = 0.9;
        }
    };

    audio.addEventListener("timeupdate", pausing_function);
}

// 播放单个单词
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

// 点击单词播放
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
            break;
        }
        c += 1;
    }
}

// 录音相关功能
var soundAllowed = function (stream) {
    permission = true;
    audioContent = new AudioContext();
    gumStream = stream;
    audioStream = audioContent.createMediaStreamSource(stream);
    rec = new Recorder(audioStream, { numChannels: 1 })
    rec.record()
}

var soundNotAllowed = function (error) {
    console.log(error);
    alert('マイクの使用が許可されていません。');
}

// 听发音按钮
hbutton.onclick = function () {
    reftextval = reftext.value;
    if (!reftextval.trim()) {
        alert("テキストを入力してください。");
        return;
    }

    document.getElementById('ttsloader').style.display = "block";
    document.getElementById('ttsList').style.display = "none";

    if (reftextval != lastgettstext) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/gettts', true);
        xhr.responseType = "blob";

        xhr.onload = function () {
            if (xhr.status === 200) {
                var blobpronun = xhr.response;
                var offsets = xhr.getResponseHeader("offsets");
                offsetsarr = offsets.substring(1, offsets.length - 1).replace(/ /g, "").split(',').map(Number);

                objectUrlMain = URL.createObjectURL(blobpronun);

                var au = document.createElement('audio');
                au.controls = true;
                au.autoplay = true;
                au.id = "ttsaudio";
                au.src = objectUrlMain;

                var ttsList = document.getElementById('ttsList');
                ttsList.innerHTML = '';
                ttsList.appendChild(au);

                document.getElementById('ttsloader').style.display = "none";
                ttsList.style.display = "block";

                lastgettstext = reftextval;
                wordlist = reftextval.split(" ");
                for (var i = 0; i < wordlist.length; i++) {
                    getttsforword(wordlist[i]);
                }
            }
        };

        const dat = new FormData();
        dat.append("reftext", reftextval);
        xhr.send(dat);
    }
    return false;
}

// 获取单词发音
function getttsforword(word) {
    var request = new XMLHttpRequest();
    request.open('POST', '/getttsforword', true);
    request.responseType = "blob";

    request.onload = () => {
        var blobpronun = request.response;
        var objectUrl = URL.createObjectURL(blobpronun);
        wordaudiourls.push({ word, objectUrl });
    }
    const dat = new FormData();
    dat.append("word", word);
    request.send(dat);
}

// 随机文本按钮
ttbutton.onclick = function () {
    var request = new XMLHttpRequest();
    request.open('POST', '/gettonguetwister', true);

    request.onload = () => {
        const data = JSON.parse(request.responseText);
        reftextval = data.tt;
        reftext.value = reftextval;
        reftext.innerText = reftextval;
    }

    request.send();
    return false;
}

// 录音按钮
document.getElementById('buttonmic').onclick = function () {
    if (!reftext.value.trim()) {
        alert("参照テキストを入力してください。");
        return;
    }

    if (start) {
        start = false;
        this.innerHTML = "<span class='fa fa-microphone'></span>新しい録音";
        this.className = "green-button";
        rec.stop();
        gumStream.getAudioTracks()[0].stop();
        rec.exportWAV(createDownloadLink);
    } else {
        // 清除之前的录音和评分
        if (recordingsList) {
            recordingsList.innerHTML = '';
        }

        // 重置评分相关变量和显示
        omittedwords = "";
        insertedwords = "";
        document.getElementById("wih").style.display = "none";
        wordsinserted.style.display = "none";
        wordsinserted.innerText = "";
        wordsomitted.innerText = "";

        document.getElementById("metrics").style.display = "none";
        document.getElementById("recordcont").style.display = "none";
        document.getElementById("recordloader").style.display = "none";

        wordrow.innerHTML = '';
        phonemerow.innerHTML = '';
        scorerow.innerHTML = '';

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

        this.innerHTML = "<span class='fa fa-stop'></span>停止";
        this.className = "red-button";
    }
};

// 填充评分详情
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

// 填充评分数据
function fillData(data) {
    document.getElementById("recordloader").classList.remove('show');
    document.getElementById("metrics").classList.add('show');

    accuracyscore.innerText = data.AccuracyScore;
    fluencyscore.innerText = data.FluencyScore;
    completenessscore.innerText = data.CompletenessScore;
    pronscore.innerText = parseInt(data.PronScore, 10);

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

// 处理录音结果
function createDownloadLink(blob) {
    var url = URL.createObjectURL(blob);
    var au = document.createElement('audio');
    var li = document.createElement('p');

    au.controls = true;
    au.src = url;
    li.appendChild(au);
    recordingsList.appendChild(li);

    document.getElementById('recordloader').classList.add('show');
    document.getElementById('recordcont').classList.add('show');

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/ackaud', true);

    xhr.onload = () => {
        const data = JSON.parse(xhr.responseText);
        if (data.RecognitionStatus == "Success") {
            fillData(data.NBest[0]);
        } else {
            alert("音声の認識に失敗しました。もう一度お試しください。");
            document.getElementById('recordloader').classList.remove('show');
        }
    };

    const formData = new FormData();
    formData.append("audio_data", blob, new Date().toISOString());
    formData.append("reftext", reftextval);

    xhr.send(formData);
}

// Topic页面功能
document.addEventListener('DOMContentLoaded', function () {
    const generateTopicBtn = document.getElementById('generateTopic');
    const recordTopicBtn = document.getElementById('recordTopic');
    const topicText = document.getElementById('topicText');
    const transcribedText = document.getElementById('transcribedText');
    const grammarCorrection = document.getElementById('grammarCorrection');
    const feedbackText = document.getElementById('feedbackText');

    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];

    // 生成话题
    if (generateTopicBtn) {
        generateTopicBtn.addEventListener('click', async function () {
            try {
                const response = await fetch('/generate_topic', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                topicText.value = data.topic;

                // 重置其他字段
                transcribedText.value = '';
                grammarCorrection.value = '';
                feedbackText.value = '';
                document.getElementById('grammarScore').textContent = '-';
                document.getElementById('contentScore').textContent = '-';
                document.getElementById('relevanceScore').textContent = '-';
            } catch (error) {
                console.error('Error:', error);
                alert('トピックの生成に失敗しました。');
            }
        });
    }

    // Topic录音功能
    if (recordTopicBtn) {
        recordTopicBtn.addEventListener('click', async function () {
            if (!topicText.value.trim()) {
                alert('先にトピックを生成してください。');
                return;
            }

            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            channelCount: 1,
                            sampleRate: 16000,
                            sampleSize: 16,
                            volume: 1
                        }
                    });

                    mediaRecorder = new MediaRecorder(stream, {
                        mimeType: 'audio/webm;codecs=opus',
                        audioBitsPerSecond: 16000
                    });

                    audioChunks = [];

                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            audioChunks.push(event.data);
                        }
                    };

                    mediaRecorder.onstop = async () => {
                        try {
                            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                            const formData = new FormData();
                            formData.append('audio', audioBlob, 'recording.webm');
                            formData.append('topic', topicText.value);

                            transcribedText.value = '音声を認識しています...';
                            const response = await fetch('/process_speech', {
                                method: 'POST',
                                body: formData
                            });

                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }

                            const result = await response.json();

                            if (result.error) {
                                throw new Error(result.error);
                            }

                            transcribedText.value = result.transcription || '音声を認識できませんでした。';

                            if (result.grammar_correction) {
                                grammarCorrection.value = result.grammar_correction;
                            }

                            if (result.feedback) {
                                feedbackText.value = result.feedback;
                            }

                            // 更新分数显示
                            if (result.scores) {
                                document.getElementById('grammarScore').textContent =
                                    result.scores.grammar_score.toFixed(1);
                                document.getElementById('contentScore').textContent =
                                    result.scores.content_score.toFixed(1);
                                document.getElementById('relevanceScore').textContent =
                                    result.scores.relevance_score.toFixed(1);
                            }

                        } catch (error) {
                            console.error('Error:', error);
                            transcribedText.value = '音声認識に失敗しました。';
                            alert(error.message || '音声の処理に失敗しました。');
                        }
                    };

                    mediaRecorder.start(1000); // 每秒收集一次数据
                    isRecording = true;
                    this.innerHTML = '<span class="fa fa-stop"></span>停止';
                    this.className = 'red-button';

                } catch (error) {
                    console.error('Error:', error);
                    alert('マイクの使用が許可されていません。');
                }
            } else {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
                isRecording = false;
                this.innerHTML = '<span class="fa fa-microphone"></span>録音';
                this.className = 'green-button';
            }
        });
    }

    // 生成文本按钮
    document.getElementById('generateText').addEventListener('click', function () {
        fetch('/generate_text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                document.getElementById('reftext').value = data.text;
            })
            .catch(error => {
                console.error('Error:', error);
                alert('文章の生成に失敗しました。');
            });
    });
});

// 初始化图表
window.onload = function () {
    initializeCharts();
};

// 初始化所有图表
async function initializeCharts() {
    try {
        const response = await fetch('/get_user_scores');
        if (!response.ok) {
            throw new Error('Failed to fetch scores');
        }
        const data = await response.json();

        // 初始化总体进度图表
        initScoreChart(data);

        // 初始化朗读分数图表
        initReadingChart(data);

        // 初始化话题分数图表
        initTopicChart(data);
    } catch (error) {
        console.error('Error initializing charts:', error);
        document.querySelectorAll('.chart-box').forEach(box => {
            box.innerHTML = '<p class="error-message">データの読み込みに失敗しました。</p>';
        });
    }
}

// 初始化总体进度图表
function initScoreChart(data) {
    const ctx = document.getElementById('scoreChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: '総合スコア',
                    data: data.total_scores,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'スコア'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日付'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '学習進捗'
                }
            }
        }
    });
}

// 初始化朗读分数图表
function initReadingChart(data) {
    const ctx = document.getElementById('readingChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: '発音',
                    data: data.pronunciation_scores,
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '流暢性',
                    data: data.fluency_scores,
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '完成度',
                    data: data.completeness_scores,
                    borderColor: 'rgb(255, 206, 86)',
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'スコア'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日付'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '朗読スコア'
                }
            }
        }
    });
}

// 初始化话题分数图表
function initTopicChart(data) {
    const ctx = document.getElementById('topicChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: '発音',
                    data: data.topic_pronunciation_scores,
                    borderColor: 'rgb(153, 102, 255)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '流暢性',
                    data: data.topic_fluency_scores,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '文法',
                    data: data.topic_grammar_scores,
                    borderColor: 'rgb(255, 159, 64)',
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'スコア'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日付'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'トピックスコア'
                }
            }
        }
    });
}

