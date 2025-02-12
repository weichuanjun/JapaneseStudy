// API 调用函数
async function callApi(endpoint, options = {}) {
    const url = window.APP_CONFIG.getApiUrl(endpoint);
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content
        },
        credentials: 'include'
    };

    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        throw error;
    }
}

// 获取静态资源 URL
function getStaticUrl(path) {
    return window.APP_CONFIG.getAssetUrl(path);
}

// 示例：登录函数
async function login(username, password) {
    try {
        return await callApi('login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
}

// 导出工具函数
window.api = {
    call: callApi,
    getStaticUrl
}; 