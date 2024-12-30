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
                tension: 0.1
            },
            {
                label: '流暢さ',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1
            },
            {
                label: '完全性',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            },
            {
                label: '発音',
                data: [],
                borderColor: 'rgb(153, 102, 255)',
                tension: 0.1
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
                tension: 0.1
            },
            {
                label: '内容',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1
            },
            {
                label: '関連性',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
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

// 加载读文章记录
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

        // 更新图表
        if (readingChart) {
            readingChart.data.labels = data.map(record => record.date);
            readingChart.data.datasets[0].data = data.map(record => record.accuracy);
            readingChart.data.datasets[1].data = data.map(record => record.fluency);
            readingChart.data.datasets[2].data = data.map(record => record.completeness);
            readingChart.data.datasets[3].data = data.map(record => record.pronunciation);
            readingChart.update();
        }

        // 更新详细记录表格
        const tbody = document.getElementById('readingRecordsBody');
        if (tbody) {
            tbody.innerHTML = data.map(record => `
                <tr>
                    <td>${record.date}</td>
                    <td>${record.text}</td>
                    <td>${record.accuracy}</td>
                    <td>${record.fluency}</td>
                    <td>${record.completeness}</td>
                    <td>${record.pronunciation}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading reading records:', error);
        showError('readingRecordsBody', 'データの読み込みに失敗しました');
    }
}

// 加载Topic记录
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

        // 更新图表
        if (topicChart) {
            topicChart.data.labels = data.map(record => record.date);
            topicChart.data.datasets[0].data = data.map(record => record.grammar);
            topicChart.data.datasets[1].data = data.map(record => record.content);
            topicChart.data.datasets[2].data = data.map(record => record.relevance);
            topicChart.update();
        }

        // 更新详细记录表格
        const tbody = document.getElementById('topicRecordsBody');
        if (tbody) {
            tbody.innerHTML = data.map(record => `
                <tr>
                    <td>${record.date}</td>
                    <td>${record.topic}</td>
                    <td>${record.grammar}</td>
                    <td>${record.content}</td>
                    <td>${record.relevance}</td>
                </tr>
            `).join('');
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
                readingTbody.innerHTML = readingData.map((user, index) => `
                    <tr>
                        <td class="rank">${index + 1}</td>
                        <td>${user.username}</td>
                        <td>${user.average_score}</td>
                    </tr>
                `).join('');
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
                topicTbody.innerHTML = topicData.map((user, index) => `
                    <tr>
                        <td class="rank">${index + 1}</td>
                        <td>${user.username}</td>
                        <td>${user.average_score}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading leaderboards:', error);
        const errorMessage = '<tr><td colspan="3">データの読み込みに失敗しました</td></tr>';
        document.getElementById('readingLeaderboard').innerHTML = errorMessage;
        document.getElementById('topicLeaderboard').innerHTML = errorMessage;
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
        loadReadingRecords();
        loadTopicRecords();
        loadLeaderboards();

        // 设置定期刷新
        setInterval(() => {
            loadReadingRecords();
            loadTopicRecords();
            loadLeaderboards();
        }, 300000); // 每5分钟刷新一次
    }
}); 