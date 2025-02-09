document.addEventListener('DOMContentLoaded', function () {
    // 获取用户ID
    const container = document.querySelector('.vocabulary-container');
    const userId = container.dataset.userId;
    if (!userId) {
        console.error('User ID not found');
        showError('用户ID未找到，请重新登录');
        return;
    }

    let currentCategory = 'n1';
    let currentWord = null;

    // 元素引用
    const startButton = document.querySelector('.start-btn');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const wordCard = document.querySelector('.word-card');
    const mainContent = document.querySelector('.main-content');
    const historyList = document.querySelector('.history-list');
    const vocabularyModal = document.querySelector('.vocabulary-modal');
    const openVocabularyBtn = document.querySelector('.open-vocabulary-btn');
    const closeModalBtn = document.querySelector('.close-modal');
    const favoriteBtn = document.querySelector('.favorite-btn');
    const nextButton = document.querySelector('.next-btn');

    // 初始化
    loadHistory();
    loadStats();

    // 初始化类别按钮
    document.querySelectorAll('.preview-category-btn').forEach(button => {
        button.addEventListener('click', function () {
            document.querySelectorAll('.preview-category-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.category;
        });
    });

    // 开始学习按钮
    startButton.addEventListener('click', () => {
        showLoading(true);
        loadWord();
    });

    // 单词本相关事件
    openVocabularyBtn.addEventListener('click', () => {
        vocabularyModal.style.display = 'flex';
        loadFavorites();
    });

    closeModalBtn.addEventListener('click', () => {
        vocabularyModal.style.display = 'none';
    });

    favoriteBtn.addEventListener('click', () => {
        if (currentWord) {
            if (favoriteBtn.classList.contains('active')) {
                // 如果已经收藏，则取消收藏
                removeFromFavorites(currentWord);
            } else {
                // 如果未收藏，则添加到收藏
                addToFavorites(currentWord);
            }
        }
    });

    // 加载单词
    async function loadWord() {
        try {
            showLoading(true);

            const response = await window.apiCall('/api/vocabulary/word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    category: currentCategory,
                    user_id: userId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to load word');
            }

            currentWord = await response.json();
            displayWord(currentWord);

        } catch (error) {
            console.error('Error loading word:', error);
            showMessage('加载单词失败，请重试');
        } finally {
            showLoading(false);
        }
    }

    // 显示单词
    function displayWord(wordData) {
        wordCard.style.display = 'block';

        // 设置单词和读音
        wordCard.querySelector('.word').textContent = wordData.word;
        wordCard.querySelector('.reading').textContent = wordData.reading;

        // 清除旧的选项
        const optionsContainer = wordCard.querySelector('.options');
        optionsContainer.innerHTML = '';

        // 添加新选项
        wordData.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.addEventListener('click', () => checkAnswer(option));
            optionsContainer.appendChild(button);
        });

        // 隐藏示例和下一个按钮
        wordCard.querySelector('.example-section').style.display = 'none';
        wordCard.querySelector('.next-btn').style.display = 'none';
        wordCard.querySelector('.result-message').textContent = '';

        // 检查单词是否已收藏
        checkIfFavorited(wordData);
    }

    // 检查答案
    async function checkAnswer(selectedOption) {
        const isCorrect = selectedOption === currentWord.meaning;
        const wordCard = document.querySelector('.word-card');

        // 禁用所有选项
        const buttons = wordCard.querySelectorAll('.option-btn');
        buttons.forEach(button => {
            button.disabled = true;
            if (button.textContent === currentWord.meaning) {
                button.classList.add('correct');
            } else if (button.textContent === selectedOption && !isCorrect) {
                button.classList.add('incorrect');
            }
        });

        // 显示结果消息
        const resultMessage = wordCard.querySelector('.result-message');
        resultMessage.textContent = isCorrect ? '正确！' : '错误！';
        resultMessage.className = 'result-message ' + (isCorrect ? 'correct' : 'incorrect');

        // 显示示例句子
        const exampleSection = wordCard.querySelector('.example-section');
        exampleSection.style.display = 'block';
        exampleSection.querySelector('.example').textContent = currentWord.example;
        exampleSection.querySelector('.example-reading').textContent = currentWord.example_reading;
        exampleSection.querySelector('.example-meaning').textContent = currentWord.example_meaning;

        // 显示下一个按钮
        const nextButton = wordCard.querySelector('.next-btn');
        nextButton.style.display = 'block';
        nextButton.onclick = loadWord;

        // 记录答案
        try {
            await window.apiCall('/api/vocabulary/record', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    word: currentWord.word,
                    category: currentCategory,
                    is_correct: isCorrect
                })
            });

            // 更新历史记录
            addToHistory(currentWord.word, currentWord.meaning, isCorrect);

        } catch (error) {
            console.error('Error recording answer:', error);
        }
    }

    // 添加到历史记录
    function addToHistory(word, meaning, isCorrect) {
        const historyList = document.querySelector('.history-list');
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="word-info">
                <span class="word-text">${word}</span>
                <span class="word-meaning">${meaning}</span>
            </div>
            <span class="result ${isCorrect ? 'correct' : 'incorrect'}">
                ${isCorrect ? '✓' : '✗'}
            </span>
        `;
        historyList.insertBefore(historyItem, historyList.firstChild);
    }

    async function loadStats() {
        try {
            const response = await window.apiCall(`/api/vocabulary/stats?user_id=${userId}`);
            if (!response.ok) {
                throw new Error('Failed to load stats');
            }
            const stats = await response.json();
            updateStats(stats);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async function loadHistory() {
        try {
            const response = await window.apiCall(`/api/vocabulary/history?user_id=${userId}&limit=20`);
            if (!response.ok) {
                throw new Error('Failed to load history');
            }
            const history = await response.json();
            displayHistory(history);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    async function loadFavorites() {
        try {
            const response = await window.apiCall(`/api/vocabulary/favorites?user_id=${userId}`);
            if (!response.ok) {
                throw new Error('Failed to load favorites');
            }
            const favorites = await response.json();
            displayFavorites(favorites);
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }

    async function addToFavorites(word) {
        try {
            const response = await window.apiCall('/api/vocabulary/favorite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    word: word.word,
                    reading: word.reading,
                    meaning: word.meaning,
                    example: word.example,
                    example_reading: word.example_reading,
                    example_meaning: word.example_meaning,
                    category: currentCategory
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add to favorites');
            }

            const result = await response.json();
            if (result.status === 'success') {
                showMessage('单词已添加到单词本');
                favoriteBtn.classList.add('active');
            } else if (result.status === 'already exists') {
                showMessage('该单词已存在于单词本');
            }

        } catch (error) {
            console.error('Error adding to favorites:', error);
            showError('添加到单词本失败');
        }
    }

    async function removeFromFavorites(word) {
        try {
            const response = await window.apiCall(`/api/vocabulary/favorite?word=${encodeURIComponent(word.word)}&user_id=${userId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to remove from favorites');
            }

            const result = await response.json();
            if (result.status === 'success') {
                showMessage('单词已从单词本中删除');
                favoriteBtn.classList.remove('active');
            }

        } catch (error) {
            console.error('Error removing from favorites:', error);
            showError('从单词本中删除失败');
        }
    }

    async function checkIfFavorited(word) {
        try {
            const response = await window.apiCall(`/api/vocabulary/favorites?user_id=${userId}`);
            if (!response.ok) {
                throw new Error('Failed to check favorites');
            }
            const favorites = await response.json();
            const isFavorited = favorites.some(f => f.word === word.word);
            favoriteBtn.classList.toggle('active', isFavorited);
        } catch (error) {
            console.error('Error checking favorites:', error);
        }
    }

    function displayHistory(history) {
        historyList.innerHTML = '';
        history.forEach(record => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="word-info">
                    <span class="word-text">${record.word}</span>
                    <span class="word-meaning">${record.is_correct ? record.meaning || '暂无翻译' : ''}</span>
                </div>
                <span class="result ${record.is_correct ? 'correct' : 'incorrect'}">
                    ${record.is_correct ? '○' : '×'}
                </span>
            `;
            historyList.appendChild(item);
        });
    }

    function displayFavorites(favorites) {
        const favoritesList = document.querySelector('.favorites-list');
        favoritesList.innerHTML = '';
        favorites.forEach(word => {
            const item = document.createElement('div');
            item.className = 'favorite-item';

            // 默认只显示日语和图标
            item.innerHTML = `
                <div class="word-header">
                    <div>
                        <span class="word">${word.word}</span>
                        <span class="reading">${word.reading}</span>
                    </div>
                    <button class="toggle-details-btn" title="显示详情">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <div class="details" style="display: none;">
                    <div class="meaning">${word.meaning}</div>
                    <div class="example">${word.example}</div>
                    <div class="example-reading">${word.example_reading}</div>
                    <div class="example-meaning">${word.example_meaning}</div>
                </div>
                <div class="item-footer">
                    <button class="remove-btn" data-word="${word.word}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            favoritesList.appendChild(item);

            // 添加显示/隐藏详情的事件
            const toggleBtn = item.querySelector('.toggle-details-btn');
            const details = item.querySelector('.details');
            toggleBtn.addEventListener('click', () => {
                const isHidden = details.style.display === 'none';
                details.style.display = isHidden ? 'block' : 'none';
                toggleBtn.classList.toggle('active', isHidden);
            });
        });

        // 添加删除按钮事件
        document.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', async () => {
                const word = button.dataset.word;
                try {
                    const response = await window.apiCall(`/api/vocabulary/favorite?word=${encodeURIComponent(word)}&user_id=${userId}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        showMessage('单词已从单词本中删除');
                        loadFavorites();
                    }
                } catch (error) {
                    console.error('Error removing from favorites:', error);
                    showError('删除失败');
                }
            });
        });
    }

    // 显示/隐藏加载指示器
    function showLoading(show) {
        loadingIndicator.style.display = show ? 'block' : 'none';
        wordCard.style.display = show ? 'none' : 'block';
    }

    function showError(message) {
        const errorMessage = document.querySelector('.error-message');
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        loadingIndicator.style.display = 'none';
    }

    function showMessage(message) {
        // 实现一个简单的消息提示
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-popup';
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    function updateStats(stats) {
        // 实现更新统计信息的逻辑
    }

    // 使用全局 apiCall 函数
    function loadVocabulary() {
        window.apiCall('/vocabulary/api/words')
            .then(response => response.json())
            .then(data => {
                // 处理数据
            })
            .catch(error => console.error('単語の読み込みに失敗しました:', error));
    }

    // 使用全局 staticUrl 函数加载静态资源
    function loadAudio(url) {
        return window.staticUrl(`audio/${url}`);
    }

    // 使用全局 apiCall 函数提交数据
    function submitAnswer(data) {
        return window.apiCall('/vocabulary/api/submit', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}); 