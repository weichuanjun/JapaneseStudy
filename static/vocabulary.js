document.addEventListener('DOMContentLoaded', function () {
    // 获取用户ID
    const container = document.querySelector('.vocabulary-container');
    const userId = container.dataset.userId;
    if (!userId) {
        console.error('User ID not found');
        showError('用户ID未找到，请重新登录');
        return;
    }

    let currentWord = null;
    let selectedCategory = 'n5';

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

    // 事件监听器
    document.querySelectorAll('.preview-category-btn').forEach(button => {
        button.addEventListener('click', function () {
            document.querySelectorAll('.preview-category-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            selectedCategory = this.dataset.category;
        });
    });

    startButton.addEventListener('click', () => {
        showLoading('学習を準備中...');
        loadStats()
            .then(() => {
                startButton.style.display = 'none';
                mainContent.style.display = 'block';
                loadNewWord();
            })
            .catch(error => {
                showError('学習の開始に失敗しました: ' + error.message);
            });
    });

    nextButton.addEventListener('click', () => {
        loadNewWord();
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

    // API 调用函数
    async function loadNewWord() {
        showLoading('単語を生成中...');
        try {
            const response = await fetch('/api/vocabulary/word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    category: selectedCategory
                })
            });

            if (!response.ok) {
                throw new Error('Failed to load word');
            }

            const data = await response.json();
            currentWord = data;
            displayWord(data);
            loadingIndicator.style.display = 'none';
            wordCard.style.display = 'block';

        } catch (error) {
            console.error('Error loading word:', error);
            showError('単語の読み込みに失敗しました');
        }
    }

    async function recordAnswer(isCorrect) {
        try {
            const response = await fetch('/api/vocabulary/record', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    word: currentWord.word,
                    category: selectedCategory,
                    is_correct: isCorrect
                })
            });

            if (!response.ok) {
                throw new Error('Failed to record answer');
            }

            loadStats();
            loadHistory();

        } catch (error) {
            console.error('Error recording answer:', error);
        }
    }

    async function loadStats() {
        try {
            const response = await fetch(`/api/vocabulary/stats?user_id=${userId}`);
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
            const response = await fetch(`/api/vocabulary/history?user_id=${userId}&limit=20`);
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
            const response = await fetch(`/api/vocabulary/favorites?user_id=${userId}`);
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
            const response = await fetch('/api/vocabulary/favorite', {
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
                    category: selectedCategory
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add to favorites');
            }

            const result = await response.json();
            if (result.status === 'success') {
                showMessage('単語を単語帳に追加しました');
                favoriteBtn.classList.add('active');
            } else if (result.status === 'already exists') {
                showMessage('この単語は既に単語帳にあります');
            }

        } catch (error) {
            console.error('Error adding to favorites:', error);
            showError('単語帳への追加に失敗しました');
        }
    }

    async function removeFromFavorites(word) {
        try {
            const response = await fetch(`/api/vocabulary/favorite?word=${encodeURIComponent(word.word)}&user_id=${userId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to remove from favorites');
            }

            const result = await response.json();
            if (result.status === 'success') {
                showMessage('単語を単語帳から削除しました');
                favoriteBtn.classList.remove('active');
            }

        } catch (error) {
            console.error('Error removing from favorites:', error);
            showError('単語帳からの削除に失敗しました');
        }
    }

    // UI 更新函数
    function displayWord(word) {
        document.querySelector('.word').textContent = word.word;
        document.querySelector('.reading').textContent = word.reading;

        const optionsContainer = document.querySelector('.options');
        optionsContainer.innerHTML = '';

        // 随机排序选项
        const shuffledOptions = shuffleArray([...word.options]);
        shuffledOptions.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.addEventListener('click', () => handleAnswer(option === word.meaning));
            optionsContainer.appendChild(button);
        });

        // 隐藏例句和下一个按钮
        document.querySelector('.example-section').style.display = 'none';
        document.querySelector('.next-btn').style.display = 'none';
        document.querySelector('.result-message').textContent = '';

        // 检查单词是否已收藏
        checkIfFavorited(word);
    }

    async function checkIfFavorited(word) {
        try {
            const response = await fetch(`/api/vocabulary/favorites?user_id=${userId}`);
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

    function handleAnswer(isCorrect) {
        const options = document.querySelectorAll('.option-btn');
        options.forEach(button => {
            button.disabled = true;
            if (button.textContent === currentWord.meaning) {
                button.classList.add('correct');
            } else if (!isCorrect && button.textContent === currentWord.meaning) {
                button.classList.add('incorrect');
            }
        });

        recordAnswer(isCorrect);

        const resultMessage = document.querySelector('.result-message');
        resultMessage.textContent = isCorrect ? '正解です！' : '不正解です。';
        resultMessage.className = `result-message ${isCorrect ? 'correct' : 'incorrect'}`;

        // 显示例句和下一个按钮
        document.querySelector('.example-section').style.display = 'block';
        document.querySelector('.example').textContent = currentWord.example;
        document.querySelector('.example-reading').textContent = currentWord.example_reading;
        document.querySelector('.example-meaning').textContent = currentWord.example_meaning;
        document.querySelector('.next-btn').style.display = 'block';
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
                    const response = await fetch(`/api/vocabulary/favorite?word=${encodeURIComponent(word)}&user_id=${userId}`, {
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

    // 辅助函数
    function showLoading(message) {
        loadingIndicator.style.display = 'flex';
        loadingIndicator.style.flexDirection = 'column';
        loadingIndicator.style.alignItems = 'center';
        document.querySelector('.status-message').textContent = message;
        wordCard.style.display = 'none';
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

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}); 