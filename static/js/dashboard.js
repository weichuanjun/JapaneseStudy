// 图表配置
const chartConfig = {
    type: 'line',
    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
                max: 100
            }
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,  // 使用圆点样式
                    pointStyle: 'circle'   // 设置为圆形
                }
            }
        }
    }
};

let readingChart = null;
let topicChart = null;

// 读文章图表初始化
function initReadingChart() {
    const ctx = document.getElementById('readingChart');
    if (!ctx) return null;

    const data = {
        labels: [],
        datasets: [
            {
                label: '正確性',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgb(255, 99, 132)',
                tension: 0.1,
                pointStyle: 'circle'
            },
            {
                label: '流暢さ',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgb(54, 162, 235)',
                tension: 0.1,
                pointStyle: 'circle'
            },
            {
                label: '完全性',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                pointStyle: 'circle'
            },
            {
                label: '発音',
                data: [],
                borderColor: 'rgb(153, 102, 255)',
                backgroundColor: 'rgb(153, 102, 255)',
                tension: 0.1,
                pointStyle: 'circle'
            }
        ]
    };

    if (readingChart) {
        readingChart.destroy();
    }
    readingChart = new Chart(ctx, { ...chartConfig, data });
    return readingChart;
}

// Topic图表初始化
function initTopicChart() {
    const ctx = document.getElementById('topicChart');
    if (!ctx) return null;

    const data = {
        labels: [],
        datasets: [
            {
                label: '文法',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgb(255, 99, 132)',
                tension: 0.1,
                pointStyle: 'circle'
            },
            {
                label: '内容',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgb(54, 162, 235)',
                tension: 0.1,
                pointStyle: 'circle'
            },
            {
                label: '関連性',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                pointStyle: 'circle'
            }
        ]
    };

    if (topicChart) {
        topicChart.destroy();
    }
    topicChart = new Chart(ctx, { ...chartConfig, data });
    return topicChart;
}

// 显示加载状态
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading">データを読み込み中...</div>';
    }
}

// 显示错误信息
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="error">${message}</div>`;
    }
}

// 显示详细记录弹窗
function showRecordPopup(record, type) {
    // 创建弹窗元素
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    const content = document.createElement('div');
    content.className = 'popup-content';

    // 构建弹窗内容
    let popupHTML = `
        <div class="popup-header">
            <h3 class="popup-title">${type === 'reading' ? '文章を読む' : 'Topic'} 記録詳細</h3>
            <button class="popup-close">&times;</button>
        </div>
        <div class="popup-body">
    `;

    if (type === 'reading') {
        popupHTML += `
            <div class="popup-section">
                <div class="popup-section-title">日付</div>
                <div class="popup-text">${record.date}</div>
                
                <div class="popup-section-title">文章</div>
                <div class="popup-text">${record.text}</div>
                
                <div class="popup-section-title">スコア</div>
                <div class="popup-scores">
                    <div class="score-item">
                        <div class="score-label">正確性</div>
                        <div class="score-value">${record.accuracy}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">流暢さ</div>
                        <div class="score-value">${record.fluency}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">完全性</div>
                        <div class="score-value">${record.completeness}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">発音</div>
                        <div class="score-value">${record.pronunciation}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        popupHTML += `
            <div class="popup-section">
                <div class="popup-section-title">日付</div>
                <div class="popup-text">${record.date}</div>
                
                <div class="popup-section-title">トピック</div>
                <div class="popup-text">${record.topic}</div>
                
                <div class="popup-section-title">あなたの回答</div>
                <div class="popup-text">${record.answer || '回答なし'}</div>
                
                <div class="popup-section-title">文法の修正</div>
                <div class="popup-text">${record.grammar_correction || '修正なし'}</div>
                
                <div class="popup-section-title">アドバイス</div>
                <div class="popup-text">${record.feedback || 'アドバイスなし'}</div>
                
                <div class="popup-section-title">スコア</div>
                <div class="popup-scores">
                    <div class="score-item">
                        <div class="score-label">文法</div>
                        <div class="score-value">${record.grammar}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">内容</div>
                        <div class="score-value">${record.content}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">関連性</div>
                        <div class="score-value">${record.relevance}</div>
                    </div>
                </div>
            </div>
        `;
    }

    popupHTML += `</div>`;
    content.innerHTML = popupHTML;
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // 添加关闭事件
    const closeBtn = content.querySelector('.popup-close');
    closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
    });

    // 显示弹窗
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
}

// 更新加载读文章记录的函数
async function loadReadingRecords() {
    showLoading('readingRecordsBody');
    try {
        const response = await fetch('/api/reading/records');
        if (!response.ok) {
            throw new Error('データの取得に失敗しました');
        }
        const data = await response.json();

        if (!data || data.length === 0) {
            showError('readingRecordsBody', '記録が見つかりません');
            return;
        }

        // 反转数据顺序，使最新的数据在右边
        const reversedData = [...data].reverse();

        // 更新图表
        if (readingChart) {
            readingChart.data.labels = reversedData.map(record => record.date);
            readingChart.data.datasets[0].data = reversedData.map(record => record.accuracy);
            readingChart.data.datasets[1].data = reversedData.map(record => record.fluency);
            readingChart.data.datasets[2].data = reversedData.map(record => record.completeness);
            readingChart.data.datasets[3].data = reversedData.map(record => record.pronunciation);
            readingChart.update();
        }

        // 更新详细记录表格
        const tbody = document.getElementById('readingRecordsBody');
        if (tbody) {
            tbody.innerHTML = '';
            data.forEach(record => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${record.date}</td>
                    <td class="truncate">${record.text}</td>
                    <td>${record.accuracy}</td>
                    <td>${record.fluency}</td>
                    <td>${record.completeness}</td>
                    <td>${record.pronunciation}</td>
                `;
                tr.addEventListener('click', () => showRecordPopup(record, 'reading'));
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Error loading reading records:', error);
        showError('readingRecordsBody', 'データの読み込みに失敗しました');
    }
}

// 更新加载Topic记录的函数
async function loadTopicRecords() {
    showLoading('topicRecordsBody');
    try {
        const response = await fetch('/api/topic/records');
        if (!response.ok) {
            throw new Error('データの取得に失敗しました');
        }
        const data = await response.json();

        if (!data || data.length === 0) {
            showError('topicRecordsBody', '記録が見つかりません');
            return;
        }

        // 反转数据顺序，使最新的数据在右边
        const reversedData = [...data].reverse();

        // 更新图表
        if (topicChart) {
            topicChart.data.labels = reversedData.map(record => record.date);
            topicChart.data.datasets[0].data = reversedData.map(record => record.grammar);
            topicChart.data.datasets[1].data = reversedData.map(record => record.content);
            topicChart.data.datasets[2].data = reversedData.map(record => record.relevance);
            topicChart.update();
        }

        // 更新详细记录表格
        const tbody = document.getElementById('topicRecordsBody');
        if (tbody) {
            tbody.innerHTML = '';
            data.forEach(record => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${record.date}</td>
                    <td class="truncate">${record.topic}</td>
                    <td class="score-value">${record.grammar}</td>
                    <td class="score-value">${record.content}</td>
                    <td class="score-value">${record.relevance}</td>
                `;
                tr.addEventListener('click', () => showRecordPopup(record, 'topic'));
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Error loading topic records:', error);
        showError('topicRecordsBody', 'データの読み込みに失敗しました');
    }
}

// 加载排行榜
async function loadLeaderboards(difficulty = 'easy') {
    try {
        // 加载读文章排行榜
        const readingResponse = await fetch(`/api/reading/leaderboard/${difficulty}`);
        if (!readingResponse.ok) {
            throw new Error('読み込みに失敗しました');
        }
        const readingData = await readingResponse.json();
        updateLeaderboard(readingData, 'readingLeaderboard');

        // 加载Topic排行榜
        const topicResponse = await fetch(`/api/topic/leaderboard/${difficulty}`);
        if (!topicResponse.ok) {
            throw new Error('読み込みに失敗しました');
        }
        const topicData = await topicResponse.json();
        updateLeaderboard(topicData, 'topicLeaderboard');
    } catch (error) {
        console.error('Error loading leaderboards:', error);
        const errorMessage = '<tr><td colspan="3">データの読み込みに失敗しました</td></tr>';
        document.getElementById('readingLeaderboard').getElementsByTagName('tbody')[0].innerHTML = errorMessage;
        document.getElementById('topicLeaderboard').getElementsByTagName('tbody')[0].innerHTML = errorMessage;
    }
}

function updateLeaderboard(data, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) {
        console.error(`Element with id ${elementId} not found`);
        return;
    }

    tbody.innerHTML = '';

    // 生成10行数据，不足的用占位符填充
    for (let i = 0; i < 10; i++) {
        const item = data[i] || null;
        const row = document.createElement('tr');
        row.className = 'leaderboard-row';
        if (item) {
            row.dataset.userId = item.user_id;
            row.innerHTML = `
                <td>
                    <span class="rank ${i < 3 ? `rank-${i + 1}` : ''}">${i + 1}</span>
                </td>
                <td>
                    <div class="leaderboard-user">
                        <div class="leaderboard-avatar">
                            ${item.avatar_data ?
                    `<img src="${item.avatar_data}" alt="${item.username}">` :
                    item.username[0]
                }
                        </div>
                        <span>${item.username}</span>
                    </div>
                </td>
                <td><span class="info-value">${item.average_score.toFixed(1)}</span></td>
            `;
        } else {
            row.innerHTML = `
                <td>
                    <span class="rank ${i < 3 ? `rank-${i + 1}` : ''}">${i + 1}</span>
                </td>
                <td>
                    <div class="leaderboard-user">
                        <span>-</span>
                    </div>
                </td>
                <td><span class="info-value">-</span></td>
            `;
        }
        tbody.appendChild(row);
    }

    // 重新绑定用户信息弹窗事件
    bindUserPopupEvents();
}

// 刷新dashboard数据
function refreshDashboard() {
    if (document.getElementById('dashboardTab').classList.contains('active')) {
        loadReadingRecords();
        loadTopicRecords();
        loadLeaderboards();
    }
}

// 初始化dashboard
document.addEventListener('DOMContentLoaded', () => {
    const dashboardTab = document.getElementById('dashboardTab');
    if (dashboardTab) {
        // 初始化图表
        readingChart = initReadingChart();
        topicChart = initTopicChart();

        // 加载数据
        refreshDashboard();

        // 设置定期刷新
        setInterval(refreshDashboard, 300000); // 每5分钟刷新一次

        // 处理排行榜难度切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const type = this.dataset.type;
                const difficulty = this.dataset.difficulty;

                // 更新按钮状态
                document.querySelectorAll(`.tab-btn[data-type="${type}"]`).forEach(b => {
                    b.classList.remove('active');
                });
                this.classList.add('active');

                // 加载对应难度的排行榜
                if (type === 'reading') {
                    fetch(`/api/reading/leaderboard/${difficulty}`)
                        .then(response => response.json())
                        .then(data => updateLeaderboard(data, 'readingLeaderboard'))
                        .catch(error => {
                            console.error('Error loading reading leaderboard:', error);
                            document.getElementById('readingLeaderboard').innerHTML =
                                '<tr><td colspan="3">データの読み込みに失敗しました</td></tr>';
                        });
                } else if (type === 'topic') {
                    fetch(`/api/topic/leaderboard/${difficulty}`)
                        .then(response => response.json())
                        .then(data => updateLeaderboard(data, 'topicLeaderboard'))
                        .catch(error => {
                            console.error('Error loading topic leaderboard:', error);
                            document.getElementById('topicLeaderboard').innerHTML =
                                '<tr><td colspan="3">データの読み込みに失敗しました</td></tr>';
                        });
                }
            });
        });

        // 初始加载排行榜
        loadLeaderboards('easy');
    }
});

// 绑定用户信息弹窗事件
function bindUserPopupEvents() {
    const userInfoPopup = document.getElementById('userInfoPopup');
    if (!userInfoPopup) {
        console.error('User info popup element not found');
        return;
    }

    const leaderboardUsers = document.querySelectorAll('.leaderboard-user');
    let timeout;

    leaderboardUsers.forEach(user => {
        user.addEventListener('mouseenter', async function (e) {
            const row = this.closest('.leaderboard-row');
            if (!row) return;

            const userId = row.dataset.userId;
            if (!userId) return;

            clearTimeout(timeout);

            try {
                const response = await fetch(`/api/user/${userId}`);
                const data = await response.json();

                if (data.success) {
                    const user = data.user;

                    // 更新弹窗内容
                    document.getElementById('popupUsername').textContent = user.username;
                    document.getElementById('popupJoinDate').textContent = `会員登録: ${user.created_at}`;
                    document.getElementById('popupReadingScore').textContent =
                        (user.avg_reading_score || 0).toFixed(1);
                    document.getElementById('popupTopicScore').textContent =
                        (user.avg_topic_score || 0).toFixed(1);
                    document.getElementById('popupTotalPractices').textContent =
                        user.total_practices || 0;
                    document.getElementById('popupTotalStudyTime').textContent =
                        `${user.total_study_time || 0}分`;
                    document.getElementById('popupBirthday').textContent =
                        user.birthday || '-';
                    document.getElementById('popupZodiac').textContent =
                        user.zodiac_sign || '-';
                    document.getElementById('popupMBTI').textContent =
                        user.mbti || '-';
                    document.getElementById('popupStreakDays').textContent =
                        `${user.streak_days || 0}日`;
                    document.getElementById('popupBio').textContent =
                        user.bio || '-';

                    // 处理头像显示
                    const avatarImg = document.getElementById('popupUserAvatar');
                    const avatarInitial = document.getElementById('popupUserInitial');

                    if (user.avatar_data) {
                        avatarImg.src = user.avatar_data;
                        avatarImg.style.display = 'block';
                        avatarInitial.style.display = 'none';
                    } else {
                        avatarImg.style.display = 'none';
                        avatarInitial.style.display = 'flex';
                        avatarInitial.textContent = user.username[0];
                        avatarInitial.style.setProperty('--avatar-color', getRandomColor(user.username));
                    }

                    // 先显示弹窗但设为不可见，以获取实际尺寸
                    userInfoPopup.style.visibility = 'hidden';
                    userInfoPopup.classList.add('show');

                    // 获取实际尺寸
                    const popupHeight = userInfoPopup.offsetHeight;
                    const popupWidth = userInfoPopup.offsetWidth;

                    // 获取视口尺寸
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    // 获取触发元素位置
                    const rect = this.getBoundingClientRect();

                    // 计算最佳位置
                    let left = rect.right + 10; // 默认显示在右侧
                    let top = rect.top;

                    // 如果右侧空间不足，显示在左侧
                    if (left + popupWidth > viewportWidth) {
                        left = rect.left - popupWidth - 10;
                    }

                    // 确保左侧也有足够空间
                    if (left < 10) {
                        left = 10;
                    }

                    // 调整垂直位置
                    if (top + popupHeight > viewportHeight) {
                        // 如果底部空间不足，向上对齐
                        top = viewportHeight - popupHeight - 10;
                    }

                    // 确保顶部不会超出视口
                    if (top < 10) {
                        top = 10;
                    }

                    // 应用位置并显示弹窗
                    userInfoPopup.style.left = `${left}px`;
                    userInfoPopup.style.top = `${top}px`;
                    userInfoPopup.style.visibility = 'visible';
                }
            } catch (error) {
                console.error('Error fetching user info:', error);
            }
        });

        user.addEventListener('mouseleave', function () {
            timeout = setTimeout(() => {
                userInfoPopup.classList.remove('show');
            }, 300);
        });
    });

    userInfoPopup.addEventListener('mouseenter', () => {
        clearTimeout(timeout);
    });

    userInfoPopup.addEventListener('mouseleave', () => {
        userInfoPopup.classList.remove('show');
    });
} 