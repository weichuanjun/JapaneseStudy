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
                    <td>${record.grammar}</td>
                    <td>${record.content}</td>
                    <td>${record.relevance}</td>
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
async function loadLeaderboards() {
    try {
        // 加载读文章排行榜
        const readingResponse = await fetch('/api/reading/leaderboard');
        if (!readingResponse.ok) {
            throw new Error('読み込みに失敗しました');
        }
        const readingData = await readingResponse.json();
        const readingTbody = document.getElementById('readingLeaderboard');
        if (readingTbody) {
            if (readingData.length === 0) {
                readingTbody.innerHTML = '<tr><td colspan="3">データがありません</td></tr>';
            } else {
                updateLeaderboard(readingData, 'readingLeaderboard');
            }
        }

        // 加载Topic排行榜
        const topicResponse = await fetch('/api/topic/leaderboard');
        if (!topicResponse.ok) {
            throw new Error('読み込みに失敗しました');
        }
        const topicData = await topicResponse.json();
        const topicTbody = document.getElementById('topicLeaderboard');
        if (topicTbody) {
            if (topicData.length === 0) {
                topicTbody.innerHTML = '<tr><td colspan="3">データがありません</td></tr>';
            } else {
                updateLeaderboard(topicData, 'topicLeaderboard');
            }
        }
    } catch (error) {
        console.error('Error loading leaderboards:', error);
        const errorMessage = '<tr><td colspan="3">データの読み込みに失敗しました</td></tr>';
        document.getElementById('readingLeaderboard').innerHTML = errorMessage;
        document.getElementById('topicLeaderboard').innerHTML = errorMessage;
    }
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

        // 监听标签切换
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = e.target.getAttribute('data-tab');

                // 更新URL，但不刷新页面
                const url = new URL(window.location);
                url.searchParams.set('active_tab', tabId);
                window.history.pushState({}, '', url);

                // 切换标签显示
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.getElementById(tabId + 'Tab').classList.add('active');

                // 更新导航栏active状态
                document.querySelectorAll('.nav-links a').forEach(a => {
                    a.classList.remove('active');
                });
                e.target.classList.add('active');

                // 如果切换到dashboard，刷新数据
                if (tabId === 'dashboard') {
                    refreshDashboard();
                }
            });
        });
    }
});

function updateLeaderboard(data, elementId) {
    const tbody = document.getElementById(elementId);
    tbody.innerHTML = '';

    data.forEach((item, index) => {
        const tr = document.createElement('tr');

        // 添加排名
        const rankTd = document.createElement('td');
        const rankSpan = document.createElement('span');
        rankSpan.className = `rank ${index < 3 ? `rank-${index + 1}` : 'rank-other'}`;
        rankSpan.textContent = index + 1;
        rankTd.appendChild(rankSpan);

        // 添加用户名
        const usernameTd = document.createElement('td');
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.textContent = item.username;
        usernameTd.appendChild(usernameSpan);

        // 添加分数
        const scoreTd = document.createElement('td');
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = item.average_score;
        scoreTd.appendChild(scoreSpan);

        tr.appendChild(rankTd);
        tr.appendChild(usernameTd);
        tr.appendChild(scoreTd);
        tbody.appendChild(tr);
    });
} 