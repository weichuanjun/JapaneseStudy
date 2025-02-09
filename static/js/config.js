// 前端环境配置
(function () {
    const env = document.querySelector('meta[name="environment"]')?.content || 'development';

    const configs = {
        development: {
            API_BASE_URL: '',  // 本地开发使用相对路径
            STATIC_BASE_URL: '/static',
            CLOUDFRONT_DOMAIN: '',
            AZURE_REGION: document.querySelector('meta[name="azure-region"]')?.content,
            SUBSCRIPTION_KEY: document.querySelector('meta[name="subscription-key"]')?.content
        },
        production: {
            API_BASE_URL: document.querySelector('meta[name="api-base-url"]')?.content,
            STATIC_BASE_URL: document.querySelector('meta[name="static-base-url"]')?.content,
            CLOUDFRONT_DOMAIN: document.querySelector('meta[name="cloudfront-domain"]')?.content,
            AZURE_REGION: document.querySelector('meta[name="azure-region"]')?.content,
            SUBSCRIPTION_KEY: document.querySelector('meta[name="subscription-key"]')?.content
        }
    };

    window.APP_CONFIG = configs[env];

    // 添加全局 API 调用函数
    window.apiCall = function (endpoint, options = {}) {
        const baseUrl = window.APP_CONFIG.API_BASE_URL;
        const url = baseUrl ? `${baseUrl}${endpoint}` : endpoint;

        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content
            }
        };

        return fetch(url, { ...defaultOptions, ...options });
    };

    // 添加全局静态资源 URL 生成函数
    window.staticUrl = function (path) {
        return `${window.APP_CONFIG.STATIC_BASE_URL}/${path}`;
    };
})(); 