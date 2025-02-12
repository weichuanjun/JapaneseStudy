// 前端环境配置
(function () {
    const env = document.querySelector('meta[name="environment"]')?.content || 'development';
    const apiBaseUrl = document.querySelector('meta[name="api-base-url"]')?.content;
    const staticBaseUrl = document.querySelector('meta[name="static-base-url"]')?.content;
    const cloudfrontDomain = document.querySelector('meta[name="cloudfront-domain"]')?.content;

    const configs = {
        development: {
            API_CONFIG: {
                BASE_URL: '',
                STAGE: 'dev'
            },
            S3_CONFIG: {
                BUCKET_NAME: 'jp-study',
                REGION: 'ap-northeast-1',
                BUCKET_URL: '/static',
                CLOUDFRONT_URL: ''
            },
            ENV: {
                IS_PRODUCTION: false,
                USE_CLOUDFRONT: false
            }
        },
        production: {
            API_CONFIG: {
                BASE_URL: apiBaseUrl || 'https://xlyfeojyl0.execute-api.ap-northeast-1.amazonaws.com/jp-study',
                STAGE: 'Prod'
            },
            S3_CONFIG: {
                BUCKET_NAME: 'jp-study',
                REGION: 'ap-northeast-1',
                BUCKET_URL: `https://jp-study.s3.ap-northeast-1.amazonaws.com`,
                CLOUDFRONT_URL: cloudfrontDomain || 'https://d3mnw1kshao4eu.cloudfront.net'
            },
            ENV: {
                IS_PRODUCTION: true,
                USE_CLOUDFRONT: true
            }
        }
    };

    const config = configs[env];

    // 获取资源 URL
    function getAssetUrl(path) {
        if (config.ENV.USE_CLOUDFRONT && config.ENV.IS_PRODUCTION) {
            return `${config.S3_CONFIG.CLOUDFRONT_URL}/${path}`;
        }
        return config.ENV.IS_PRODUCTION
            ? `${config.S3_CONFIG.BUCKET_URL}/${path}`
            : path;
    }

    // 获取 API URL
    function getApiUrl(endpoint) {
        const baseUrl = config.API_CONFIG.BASE_URL;
        return baseUrl ? `${baseUrl}/${endpoint}`.replace(/\/+/g, '/') : endpoint;
    }

    // 导出配置
    window.APP_CONFIG = {
        ...config,
        getAssetUrl,
        getApiUrl
    };
})();

// API Gateway 配置
const API_CONFIG = {
    BASE_URL: 'https://xlyfeojyl0.execute-api.ap-northeast-1.amazonaws.com/jp-study',
    STAGE: 'Prod'
};

// S3 配置
const S3_CONFIG = {
    BUCKET_NAME: 'japanese-study-static-files',
    REGION: 'ap-northeast-1',
    CLOUDFRONT_URL: 'https://d3mnw1kshao4eu.cloudfront.net'
};

// 环境配置
const ENV = {
    IS_PRODUCTION: true,
    USE_CLOUDFRONT: true
};

// 获取资源 URL
function getAssetUrl(path) {
    if (ENV.USE_CLOUDFRONT && ENV.IS_PRODUCTION) {
        return `https://${S3_CONFIG.CLOUDFRONT_URL}/${path}`;
    }
    return path;
}

// 获取 API URL
function getApiUrl(endpoint) {
    return `${API_CONFIG.BASE_URL}/${endpoint}`.replace(/\/+/g, '/');
}

// 导出配置
window.APP_CONFIG = {
    API_CONFIG,
    S3_CONFIG,
    ENV,
    getAssetUrl,
    getApiUrl
}; 