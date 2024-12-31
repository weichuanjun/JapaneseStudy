document.addEventListener('DOMContentLoaded', function () {
    let currentWord = null;
    let selectedCategory = 'n5';
    let isAnswered = false;

    // 获取DOM元素
    const startButton = document.querySelector('.start-btn');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const statusMessage = document.querySelector('.status-message');
    const errorMessage = document.querySelector('.error-message');
    const mainContent = document.querySelector('.main-content');

    // 预览类别按钮
    const previewCategoryButtons = document.querySelectorAll('.preview-category-btn');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const wordJapanese = document.querySelector('.word-japanese');
    const wordReading = document.querySelector('.word-reading');
    const optionsContainer = document.querySelector('.options-container');
    const nextButton = document.querySelector('.next-btn');
    const exampleSection = document.querySelector('.example-section');
    const exampleJapanese = document.querySelector('.example-japanese');
    const exampleReading = document.querySelector('.example-reading');
    const exampleMeaning = document.querySelector('.example-meaning');

    // 统计元素
    const totalWordsElement = document.getElementById('totalWords');
    const correctWordsElement = document.getElementById('correctWords');
    const accuracyElement = document.getElementById('accuracy');

    // 显示错误信息
    function showError(message) {
        console.error('Error:', message);
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        loadingIndicator.classList.remove('show');
        // 5秒后自动隐藏错误信息
        setTimeout(() => {
            hideError();
        }, 5000);
    }

    // 隐藏错误信息
    function hideError() {
        errorMessage.classList.remove('show');
    }

    // 显示加载状态
    function showLoading(message) {
        loadingIndicator.classList.add('show');
        statusMessage.textContent = message;
        hideError();
    }

    // 隐藏加载状态
    function hideLoading() {
        loadingIndicator.classList.remove('show');
    }

    // 加载统计数据
    function loadStats() {
        return new Promise((resolve, reject) => {
            showLoading('統計データを読み込み中...');
            fetch('/api/vocabulary/stats?user_id=' + getUserId())
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    totalWordsElement.textContent = data.total_words;
                    correctWordsElement.textContent = data.correct_words;
                    accuracyElement.textContent = Math.round(data.accuracy * 100) + '%';
                    hideLoading();
                    resolve();
                })
                .catch(error => {
                    console.error('Error loading stats:', error);
                    showError('統計データの読み込みに失敗しました: ' + error.message);
                    reject(error);
                });
        });
    }

    // 获取用户ID
    function getUserId() {
        const container = document.querySelector('.vocabulary-container');
        return container.getAttribute('data-user-id');
    }

    // 加载新单词
    function loadNewWord() {
        isAnswered = false;
        exampleSection.classList.remove('show');
        nextButton.classList.remove('show');

        // 清除选项的样式
        const options = document.querySelectorAll('.option-btn');
        options.forEach(option => {
            option.classList.remove('correct', 'wrong');
        });

        showLoading('単語を生成中...');
        fetch('/api/vocabulary/word', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category: selectedCategory,
                user_id: getUserId()
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                hideLoading();
                currentWord = data;
                displayWord(data);
            })
            .catch(error => {
                console.error('Error loading word:', error);
                showError('単語の生成に失敗しました: ' + error.message);
                // 3秒后重试
                setTimeout(() => {
                    hideError();
                    loadNewWord();
                }, 3000);
            });
    }

    // 显示单词
    function displayWord(wordData) {
        wordJapanese.textContent = wordData.word;
        wordReading.textContent = wordData.reading;

        // 打乱选项顺序
        const shuffledOptions = shuffleArray([...wordData.options]);

        // 清空并添加新选项
        optionsContainer.innerHTML = '';
        shuffledOptions.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.addEventListener('click', () => checkAnswer(option));
            optionsContainer.appendChild(button);
        });

        // 设置示例句子（但暂时不显示）
        exampleJapanese.textContent = wordData.example;
        exampleReading.textContent = wordData.example_reading;
        exampleMeaning.textContent = wordData.example_meaning;
    }

    // 检查答案
    function checkAnswer(selectedOption) {
        if (isAnswered) return;
        isAnswered = true;

        const isCorrect = selectedOption === currentWord.meaning;
        const options = document.querySelectorAll('.option-btn');

        options.forEach(option => {
            if (option.textContent === currentWord.meaning) {
                option.classList.add('correct');
            } else if (option.textContent === selectedOption && !isCorrect) {
                option.classList.add('wrong');
            }
        });

        // 记录答案
        fetch('/api/vocabulary/record', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: getUserId(),
                word: currentWord.word,
                category: selectedCategory,
                is_correct: isCorrect
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                loadStats();
            })
            .catch(error => {
                console.error('Error recording answer:', error);
                showError('回答の記録に失敗しました: ' + error.message);
            });

        // 显示例句和下一个按钮
        exampleSection.classList.add('show');
        nextButton.classList.add('show');
    }

    // 工具函数：打乱数组
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // 更新类别选择
    function updateCategory(category) {
        selectedCategory = category;

        // 更新预览按钮状态
        previewCategoryButtons.forEach(btn => {
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 更新主内容区域的类别按钮状态
        categoryButtons.forEach(btn => {
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // 开始学习
    function startLearning() {
        showLoading('学習を準備中...');
        loadStats()
            .then(() => {
                return fetch('/api/vocabulary/word', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        category: selectedCategory,
                        user_id: getUserId()
                    })
                });
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                document.querySelector('.start-section').style.display = 'none';
                mainContent.classList.add('show');
                hideLoading();
                currentWord = data;
                displayWord(data);
            })
            .catch(error => {
                console.error('Error starting learning:', error);
                showError('学習の開始に失敗しました: ' + error.message);
                // 3秒后重试
                setTimeout(() => {
                    hideError();
                    startLearning();
                }, 3000);
            });
    }

    // 事件监听器
    startButton.addEventListener('click', startLearning);

    // 预览类别按钮事件监听
    previewCategoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            updateCategory(button.dataset.category);
        });
    });

    // 主内容区域类别按钮事件监听
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            updateCategory(button.dataset.category);
            loadNewWord();
        });
    });

    nextButton.addEventListener('click', loadNewWord);
}); 