// 全局变量
let currentPage = 1;
let currentPostId = null;
let currentPopupCloseHandler = null;  // 添加全局变量来跟踪当前的点击外部关闭处理器
let postDetailUpdateInterval = null;  // 添加更新计时器变量
let selectedTags = new Set();  // 用于存储选中的标签
let currentFilterTag = null;   // 用于存储当前筛选的标签
let autoRefreshInterval = null;
let lastUpdateTime = null;

// 生成随机柔和的颜色
function generatePastelColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 80%)`;
}

// 加载标签列表
function loadTags() {
    window.apiCall('/forum/api/tags')
        .then(response => response.json())
        .then(tags => {
            // 更新标签筛选器
            const filterContainer = document.querySelector('.tag-filter-container');
            filterContainer.innerHTML = '';
            tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag';
                tagElement.textContent = `#${tag.name}`;
                tagElement.style.backgroundColor = tag.color;
                tagElement.dataset.tagId = tag.id;
                tagElement.onclick = () => filterByTag(tag.id);
                filterContainer.appendChild(tagElement);
            });

            // 更新新建帖子表单的标签下拉列表
            const tagSelect = document.getElementById('tag');
            tagSelect.innerHTML = '<option value="">タグを選択</option>';
            tags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag.id;
                option.textContent = tag.name;
                option.dataset.color = tag.color;
                tagSelect.appendChild(option);
            });
        })
        .catch(error => console.error('タグの読み込みに失敗しました:', error));
}

// 根据标签筛选帖子
function filterByTag(tagId) {
    currentFilterTag = currentFilterTag === tagId ? null : tagId;
    const tags = document.querySelectorAll('.tag');
    tags.forEach(tag => {
        if (tag.dataset.tagId === String(tagId)) {
            tag.classList.toggle('active');
        } else {
            tag.classList.remove('active');
        }
    });
    loadPosts(1);
}

// 统一的用户信息显示函数
function showUserInfo(userId, clickEvent) {
    if (!userId) {
        console.error('ユーザーIDが指定されていません');
        return;
    }

    // 检查所有必需的 DOM 元素
    const elements = {
        popup: document.getElementById('forumUserInfoPopup'),
        username: document.getElementById('forumPopupUsername'),
        bio: document.getElementById('forumPopupBio'),
        readingScore: document.getElementById('forumPopupReadingScore'),
        postCount: document.getElementById('forumPopupPostCount'),
        commentCount: document.getElementById('forumPopupCommentCount'),
        totalPractices: document.getElementById('forumPopupTotalPractices'),
        totalStudyTime: document.getElementById('forumPopupTotalStudyTime'),
        streakDays: document.getElementById('forumPopupStreakDays'),
        avatarImg: document.getElementById('forumPopupUserAvatar'),
        avatarInitial: document.getElementById('forumPopupUserInitial'),
        posts: document.getElementById('forumPopupPosts')
    };

    // 检查是否所有元素都存在
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`Required element not found: ${key}`);
            return;
        }
    }

    // 如果已经有弹窗打开，先移除之前的事件监听器
    if (currentPopupCloseHandler) {
        document.removeEventListener('click', currentPopupCloseHandler);
        currentPopupCloseHandler = null;
    }

    window.apiCall(`/forum/api/user/${userId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const user = data.user;

                try {
                    // 更新弹窗内容
                    elements.username.textContent = user.username;
                    elements.bio.textContent = user.bio || '-';
                    elements.readingScore.textContent = (user.avg_reading_score || 0).toFixed(1);
                    elements.postCount.textContent = user.post_count || 0;
                    elements.commentCount.textContent = user.comment_count || 0;
                    elements.totalPractices.textContent = user.total_practices || 0;
                    elements.totalStudyTime.textContent = `${user.total_study_time || 0}分`;
                    elements.streakDays.textContent = `${user.streak_days || 0}日`;

                    // 处理头像显示
                    if (user.avatar_data) {
                        elements.avatarImg.src = user.avatar_data;
                        elements.avatarImg.style.display = 'block';
                        elements.avatarInitial.style.display = 'none';
                    } else {
                        elements.avatarImg.style.display = 'none';
                        elements.avatarInitial.style.display = 'flex';
                        elements.avatarInitial.textContent = user.username[0];
                        elements.avatarInitial.style.setProperty('--avatar-color', getRandomColor(user.username));
                    }

                    // 加载用户的帖子列表
                    loadUserPosts(userId);

                    // 检查是否在帖子详情模态框中
                    const postDetailModal = document.getElementById('postDetailModal');
                    const isInModal = postDetailModal && postDetailModal.style.display === 'block';

                    // 重置弹窗状态并显示
                    elements.popup.style.opacity = '0';
                    elements.popup.style.display = 'block';

                    // 根据不同场景放置弹窗
                    if (isInModal) {
                        // 在帖子详情模态框中
                        const modalContent = postDetailModal.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.appendChild(elements.popup);
                            elements.popup.style.position = 'absolute';
                            elements.popup.style.left = '20px';
                            elements.popup.style.top = '80px';
                        }
                    } else {
                        // 在主页面中
                        document.body.appendChild(elements.popup);

                        let targetRect;
                        if (clickEvent && clickEvent.currentTarget) {
                            targetRect = clickEvent.currentTarget.getBoundingClientRect();
                        } else {
                            // 如果没有点击事件，使用默认位置（屏幕中心）
                            targetRect = {
                                left: window.innerWidth / 2,
                                right: window.innerWidth / 2,
                                top: window.innerHeight / 2,
                                height: 0
                            };
                        }

                        // 计算弹窗位置
                        const popupWidth = elements.popup.offsetWidth;
                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;

                        // 默认显示在目标元素的左侧
                        let left = targetRect.left - popupWidth - 10;

                        // 如果左侧空间不足，则显示在右侧
                        if (left < 10) {
                            left = targetRect.right + 10;
                        }

                        // 确保不超出视口右边界
                        if (left + popupWidth > viewportWidth - 10) {
                            left = viewportWidth - popupWidth - 10;
                        }

                        // 垂直居中对齐，但确保不超出视口
                        let top = targetRect.top + (targetRect.height / 2);
                        const popupHeight = elements.popup.offsetHeight;

                        // 如果弹窗高度超过视口高度的80%，设置最大高度
                        if (popupHeight > viewportHeight * 0.8) {
                            elements.popup.style.maxHeight = `${viewportHeight * 0.8}px`;
                            top = viewportHeight * 0.1; // 距离顶部10%
                        } else {
                            // 确保弹窗完全在视口内
                            top = Math.max(10, Math.min(viewportHeight - popupHeight - 10, top - popupHeight / 2));
                        }

                        // 设置位置
                        elements.popup.style.position = 'fixed';
                        elements.popup.style.left = `${left}px`;
                        elements.popup.style.top = `${top}px`;
                    }

                    // 强制重排后显示
                    void elements.popup.offsetHeight;
                    elements.popup.style.opacity = '1';
                    elements.popup.classList.add('show');

                    // 处理关闭按钮点击事件
                    const closeBtn = elements.popup.querySelector('.close-popup');
                    if (closeBtn) {
                        closeBtn.onclick = function (e) {
                            e.stopPropagation();
                            hideUserInfoPopup();
                        };
                    }

                    // 添加点击外部关闭功能
                    currentPopupCloseHandler = function (e) {
                        if (!elements.popup.contains(e.target) &&
                            !e.target.closest('.post-author') &&
                            !e.target.closest('.comment-author') &&
                            !e.target.closest('.post-author-info')) {
                            hideUserInfoPopup();
                        }
                    };

                    // 延迟添加点击外部关闭事件，避免立即触发
                    setTimeout(() => {
                        document.addEventListener('click', currentPopupCloseHandler);
                    }, 100);

                } catch (error) {
                    console.error('Error updating popup content:', error);
                }
            }
        })
        .catch(error => console.error('Error fetching user info:', error));
}

// 隐藏用户信息弹窗的函数
function hideUserInfoPopup() {
    const popup = document.getElementById('forumUserInfoPopup');
    if (popup) {
        popup.classList.remove('show');
        popup.style.opacity = '0';
        setTimeout(() => {
            popup.style.display = 'none';
            // 确保弹窗回到 body 下
            if (popup.parentElement !== document.body) {
                document.body.appendChild(popup);
            }
        }, 300);
    }

    // 移除外部点击事件监听器
    if (currentPopupCloseHandler) {
        document.removeEventListener('click', currentPopupCloseHandler);
        currentPopupCloseHandler = null;
    }
}

// 加载用户的帖子列表
function loadUserPosts(userId) {
    window.apiCall(`/forum/api/user/${userId}/posts`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const postsContainer = document.getElementById('forumPopupPosts');
                postsContainer.innerHTML = '';

                if (data.posts.length === 0) {
                    postsContainer.innerHTML = '<div class="no-posts">投稿はありません</div>';
                    return;
                }

                data.posts.forEach(post => {
                    const postElement = document.createElement('div');
                    postElement.className = 'user-post-item';
                    postElement.innerHTML = `
                        <div class="user-post-title">${post.title}</div>
                        <div class="user-post-meta">
                            <span class="user-post-time">${formatDate(post.created_at)}</span>
                            <span class="user-post-comments">
                                <i class="fas fa-comment"></i>
                                ${post.comment_count}
                            </span>
                        </div>
                    `;

                    // 添加点击事件，打开帖子详情
                    postElement.addEventListener('click', () => {
                        openPostDetail(post.id);
                    });

                    postsContainer.appendChild(postElement);
                });
            }
        })
        .catch(error => console.error('Error loading user posts:', error));
}

// 生成随机颜色
function getRandomColor(username) {
    const colors = [
        '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
        '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
        '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12',
        '#d35400', '#c0392b', '#7f8c8d'
    ];

    const index = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr.replace(/\s/, 'T'));
    if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateStr);
        return dateStr;
    }

    const now = new Date();
    const diff = now - date;
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;

    const padZero = (num) => String(num).padStart(2, '0');

    if (diff < minute) {
        return 'たった今';
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}時間前`;
    } else if (diff < week) {
        return `${Math.floor(diff / day)}日前`;
    } else {
        const year = date.getFullYear();
        const month = padZero(date.getMonth() + 1);
        const day = padZero(date.getDate());
        const hours = padZero(date.getHours());
        const minutes = padZero(date.getMinutes());
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    }
}

// 加载帖子列表
function loadPosts(page = 1) {
    const postsContainer = document.querySelector('.posts-container');
    const paginationContainer = document.querySelector('.pagination');

    // 更新当前页码
    currentPage = page;

    let url = `/forum/api/posts?page=${page}&per_page=20`;
    if (currentFilterTag) {
        url += `&tag_id=${currentFilterTag}`;
    }

    window.apiCall(url)
        .then(response => response.json())
        .then(data => {
            // 保存当前滚动位置
            const scrollPos = window.scrollY;

            postsContainer.innerHTML = '';
            data.posts.forEach(post => {
                const postCard = createPostCard(post);
                postsContainer.appendChild(postCard);
            });

            // 创建分页并保存总数
            createPagination(data.total, data.pages, page, paginationContainer);
            paginationContainer.dataset.total = data.total;

            // 如果是用户主动切换页面，滚动到顶部
            if (scrollPos > 0) {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        })
        .catch(error => console.error('投稿の読み込みに失敗しました:', error));
}

// 创建帖子卡片
function createPostCard(post) {
    const div = document.createElement('div');
    div.className = 'post-card';

    let avatarHtml;
    if (post.avatar_data) {
        avatarHtml = `<img src="${post.avatar_data}" alt="${post.author_name}">`;
    } else {
        const initial = post.author_name ? post.author_name.charAt(0).toUpperCase() : '?';
        avatarHtml = initial;
    }

    const tagsHtml = post.tags.map(tag =>
        `<span class="tag" style="background-color: ${tag.color}">#${tag.name}</span>`
    ).join('');

    div.innerHTML = `
        <div class="post-header">
            <div class="post-author" data-user-id="${post.author_id}">
                <div class="post-avatar" style="--avatar-color: ${getRandomColor(post.author_name)}">${avatarHtml}</div>
                <div class="author-info">
                    <span class="author-name">${post.author_name}</span>
                    <span class="post-time">${formatDate(post.created_at)}</span>
                </div>
            </div>
        </div>
        <div class="post-content-wrapper">
            <div class="post-title">${post.title}</div>
            <div class="post-content">${post.content}</div>
            <div class="post-footer">
                <span class="post-comments">${post.comment_count} 件の返信</span>
                <div class="post-tags">${tagsHtml}</div>
            </div>
        </div>
    `;

    // 添加用户信息弹窗事件
    const authorElement = div.querySelector('.post-author');
    authorElement.addEventListener('click', function (e) {
        e.stopPropagation();  // 阻止事件冒泡
        const userId = this.dataset.userId;
        if (userId) {
            showUserInfo(userId, e);
        }
    });

    // 添加帖子点击事件
    const contentWrapper = div.querySelector('.post-content-wrapper');
    contentWrapper.addEventListener('click', function (e) {
        e.stopPropagation();
        openPostDetail(post.id);
    });

    return div;
}

// 初始化论坛功能
function initializeForum() {
    console.log('Initializing forum...');

    // 加载初始帖子列表
    loadPosts(1);

    // 启动自动刷新
    startAutoRefresh();

    // 处理新建帖子表单提交
    const newPostForm = document.getElementById('newPostForm');
    if (newPostForm) {
        newPostForm.addEventListener('submit', handleNewPostSubmit);
    }

    // 处理新建评论表单提交
    const newCommentForm = document.getElementById('newCommentForm');
    if (newCommentForm) {
        newCommentForm.addEventListener('submit', handleNewCommentSubmit);
    }

    // 处理模态框关闭
    document.querySelectorAll('.close, .close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', handleModalClose);
    });

    // 点击模态框外部关闭
    window.addEventListener('click', handleOutsideModalClick);

    // 处理新建帖子按钮点击
    const newPostBtn = document.getElementById('newPostBtn');
    if (newPostBtn) {
        newPostBtn.addEventListener('click', function () {
            const modal = document.getElementById('newPostModal');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
        });
    }

    // 初始化用户信息弹窗
    initializeUserInfoPopup();
}

// 初始化用户信息弹窗
function initializeUserInfoPopup() {
    console.log('Initializing user info popup...');
    const popup = document.getElementById('forumUserInfoPopup');

    if (!popup) {
        console.error('User info popup element not found!');
        return;
    }

    // 确保弹窗初始状态正确
    popup.style.display = 'none';
    popup.style.opacity = '0';
    popup.classList.remove('show');

    // 移除可能存在的旧事件监听器
    if (currentPopupCloseHandler) {
        document.removeEventListener('click', currentPopupCloseHandler);
        currentPopupCloseHandler = null;
    }

    // 初始化关闭按钮
    const closeBtn = popup.querySelector('.close-popup');
    if (closeBtn) {
        closeBtn.onclick = function (e) {
            e.stopPropagation();
            hideUserInfoPopup();
        };
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing...');
    loadTags();  // 加载标签列表
    initializeForum();
});

// 创建分页控件
function createPagination(total, pages, currentPage, container) {
    container.innerHTML = '';
    if (pages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = '前のページ';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => loadPosts(currentPage - 1));
    container.appendChild(prevButton);

    // 显示页码按钮
    const maxButtons = 5; // 最多显示5个页码按钮
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = Math.min(pages, start + maxButtons - 1);

    // 调整起始页码
    if (end - start + 1 < maxButtons) {
        start = Math.max(1, end - maxButtons + 1);
    }

    // 添加第一页按钮
    if (start > 1) {
        const firstButton = document.createElement('button');
        firstButton.textContent = '1';
        firstButton.addEventListener('click', () => loadPosts(1));
        container.appendChild(firstButton);

        if (start > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            container.appendChild(ellipsis);
        }
    }

    // 添加页码按钮
    for (let i = start; i <= end; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = i === currentPage ? 'active' : '';
        button.addEventListener('click', () => loadPosts(i));
        container.appendChild(button);
    }

    // 添加最后一页按钮
    if (end < pages) {
        if (end < pages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            container.appendChild(ellipsis);
        }

        const lastButton = document.createElement('button');
        lastButton.textContent = pages;
        lastButton.addEventListener('click', () => loadPosts(pages));
        container.appendChild(lastButton);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = '次のページ';
    nextButton.disabled = currentPage === pages;
    nextButton.addEventListener('click', () => loadPosts(currentPage + 1));
    container.appendChild(nextButton);
}

// 创建评论元素
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment';

    let avatarHtml;
    if (comment.author_avatar_data) {
        avatarHtml = `<img src="${comment.author_avatar_data}" alt="${comment.author_name}">`;
    } else {
        const initial = comment.author_name ? comment.author_name.charAt(0).toUpperCase() : '?';
        avatarHtml = initial;
    }

    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-author" data-user-id="${comment.author_id}">
                <div class="comment-avatar" style="--avatar-color: ${getRandomColor(comment.author_name)}">${avatarHtml}</div>
                <div class="comment-info">
                    <span class="author-name">${comment.author_name}</span>
                    <span class="comment-time">${formatDate(comment.created_at)}</span>
                </div>
            </div>
        </div>
        <p class="comment-content">${comment.content}</p>
    `;

    // 添加用户信息弹窗事件
    const authorElement = div.querySelector('.comment-author');
    authorElement.addEventListener('click', function (e) {
        e.stopPropagation();
        const userId = this.dataset.userId;
        if (userId) {
            showUserInfo(userId, e);
        }
    });

    return div;
}

// 打开帖子详情
function openPostDetail(postId) {
    currentPostId = postId;
    const modal = document.getElementById('postDetailModal');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');

    // 加载帖子详情
    loadPostDetail();

    // 设置定期更新
    if (postDetailUpdateInterval) {
        clearInterval(postDetailUpdateInterval);
    }
    postDetailUpdateInterval = setInterval(loadPostDetail, 3000); // 每5秒更新一次
}

// 加载帖子详情
function loadPostDetail() {
    if (!currentPostId) return;

    window.apiCall(`/forum/api/posts/${currentPostId}`)
        .then(response => response.json())
        .then(post => {
            if (post.error) {
                console.error('投稿の詳細の読み込みに失敗しました:', post.error);
                return;
            }

            // 更新帖子内容
            document.getElementById('postTitle').textContent = post.title;
            document.getElementById('postContent').textContent = post.content;
            document.getElementById('postAuthor').textContent = post.author_name;
            document.getElementById('postTime').textContent = formatDate(post.created_at);

            // 更新标签
            const tagsContainer = document.getElementById('postTags');
            tagsContainer.innerHTML = post.tags.map(tag =>
                `<span class="tag" style="background-color: ${tag.color}">#${tag.name}</span>`
            ).join('');

            // 更新头像
            const avatarImg = document.getElementById('postDetailAvatarImg');
            const avatarInitial = document.getElementById('postDetailAvatarInitial');
            const avatarContainer = document.getElementById('postDetailAvatar');

            if (post.author_avatar_data) {
                avatarImg.src = post.author_avatar_data;
                avatarImg.style.display = 'block';
                avatarInitial.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarInitial.style.display = 'flex';
                avatarInitial.textContent = post.author_name[0].toUpperCase();
                avatarContainer.style.setProperty('--avatar-color', getRandomColor(post.author_name));
            }

            // 添加用户信息弹窗功能
            const authorInfo = document.querySelector('.post-author-info');
            authorInfo.dataset.userId = post.author_id;

            // 移除旧的事件监听器
            const newAuthorInfo = authorInfo.cloneNode(true);
            authorInfo.parentNode.replaceChild(newAuthorInfo, authorInfo);

            // 添加新的点击事件监听器
            newAuthorInfo.addEventListener('click', function (e) {
                e.stopPropagation();
                const userId = this.dataset.userId;
                if (userId) {
                    showUserInfo(userId, e);
                }
            });

            // 更新评论
            loadComments(currentPostId);
        })
        .catch(error => {
            console.error('投稿の詳細の読み込みに失敗しました:', error);
        });
}

// 加载评论
function loadComments(postId) {
    if (!postId) {
        console.error('無効な投稿ID');
        return;
    }

    window.apiCall(`/forum/api/posts/${postId}/comments`)
        .then(response => response.json())
        .then(comments => {
            if (Array.isArray(comments)) {
                const commentsContainer = document.getElementById('commentsContainer');
                commentsContainer.innerHTML = '';
                comments.forEach(comment => {
                    const commentElement = createCommentElement(comment);
                    commentsContainer.appendChild(commentElement);
                });
            } else {
                console.error('评论数据格式错误:', comments);
            }
        })
        .catch(error => {
            console.error('コメントの読み込みに失敗しました:', error);
        });
}

// 处理新建帖子表单提交
function handleNewPostSubmit(e) {
    e.preventDefault();
    const title = this.querySelector('[name="title"]').value.trim();
    const content = this.querySelector('[name="content"]').value.trim();
    const tagIds = Array.from(selectedTags);

    if (!title || !content) {
        console.error('タイトルと内容は必須です');
        return;
    }

    window.apiCall('/forum/api/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title,
            content,
            tag_ids: tagIds
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('投稿の作成に失敗しました');
            }
            return response.json();
        })
        .then(post => {
            if (post.error) {
                console.error('投稿の作成に失敗しました:', post.error);
                return;
            }
            // 清空表单
            this.reset();
            document.getElementById('selectedTags').innerHTML = '';
            selectedTags.clear();

            // 关闭模态框
            const modal = document.getElementById('newPostModal');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');

            // 立即刷新帖子列表并重置最后更新时间
            lastUpdateTime = null;  // 重置最后更新时间，确保获取所有最新帖子
            loadPosts(1);
        })
        .catch(error => {
            console.error('投稿の作成に失敗しました:', error);
        });
}

// 处理新建评论表单提交
function handleNewCommentSubmit(e) {
    e.preventDefault();

    if (!currentPostId) {
        console.error('投稿IDが選択されていません');
        return;
    }

    const contentInput = this.querySelector('[name="content"]');
    const content = contentInput.value.trim();
    if (!content) {
        console.error('コメント内容は必須です');
        return;
    }

    window.apiCall(`/forum/api/posts/${currentPostId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
    })
        .then(response => response.json())
        .then(comment => {
            if (comment.error) {
                console.error('コメントの作成に失敗しました:', comment.error);
                return;
            }

            // 清空输入框
            contentInput.value = '';

            // 创建并添加新评论到评论列表
            const commentsContainer = document.getElementById('commentsContainer');
            const commentElement = createCommentElement(comment);
            commentsContainer.appendChild(commentElement);

            // 更新帖子列表中的评论数
            if (comment.updated_comment_count !== undefined) {
                const postCards = document.querySelectorAll('.post-card');
                postCards.forEach(card => {
                    const contentWrapper = card.querySelector('.post-content-wrapper');
                    if (contentWrapper && contentWrapper.onclick.toString().includes(`openPostDetail(${currentPostId})`)) {
                        const commentsElement = card.querySelector('.post-comments');
                        if (commentsElement) {
                            commentsElement.textContent = `${comment.updated_comment_count} 件の返信`;
                        }
                    }
                });
            }

            // 滚动到新评论
            commentElement.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            console.error('コメントの作成に失敗しました:', error);
        });
}

// 处理模态框关闭
function handleModalClose(e) {
    e.preventDefault();
    const modal = this.closest('.modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');

        // 清除更新计时器
        if (postDetailUpdateInterval) {
            clearInterval(postDetailUpdateInterval);
            postDetailUpdateInterval = null;
        }

        // 如果是帖子详情模态框，重置状态
        if (modal.id === 'postDetailModal') {
            currentPostId = null;
            document.getElementById('commentsContainer').innerHTML = '';
            document.getElementById('newCommentForm').reset();
        } else if (modal.id === 'newPostModal') {
            document.getElementById('newPostForm').reset();
        }
    }
}

// 处理点击模态框外部
function handleOutsideModalClick(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
        document.body.classList.remove('modal-open');

        // 清除更新计时器
        if (postDetailUpdateInterval) {
            clearInterval(postDetailUpdateInterval);
            postDetailUpdateInterval = null;
        }

        if (e.target.id === 'postDetailModal') {
            currentPostId = null;
            document.getElementById('commentsContainer').innerHTML = '';
            document.getElementById('newCommentForm').reset();
        } else if (e.target.id === 'newPostModal') {
            document.getElementById('newPostForm').reset();
        }
    }
}

// 处理标签选择
document.getElementById('tag').addEventListener('change', function () {
    const selectedOption = this.options[this.selectedIndex];
    if (!selectedOption.value) return;  // 跳过空选项

    const tagId = parseInt(selectedOption.value);
    const tagName = selectedOption.textContent;
    const tagColor = selectedOption.dataset.color;

    // 检查标签是否已被选中
    if (selectedTags.has(tagId)) {
        this.value = '';  // 重置选择
        return;
    }

    // 添加到已选标签
    addSelectedTag(tagId, tagName, tagColor);
    this.value = '';  // 重置选择
});

// 处理添加新标签按钮点击
document.getElementById('addTagBtn').addEventListener('click', function () {
    const newTagInput = document.getElementById('newTag');
    const tagName = newTagInput.value.trim();

    if (!tagName) return;

    // 检查是否已存在该标签
    window.apiCall('/forum/api/tags', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: tagName })
    })
        .then(response => response.json())
        .then(tag => {
            // 检查标签是否已被选中
            if (selectedTags.has(tag.id)) {
                newTagInput.value = '';
                return;
            }

            // 添加到已选标签
            addSelectedTag(tag.id, tag.name, tag.color);

            // 清空输入框
            newTagInput.value = '';

            // 刷新标签列表
            loadTags();
        })
        .catch(error => console.error('タグの追加に失敗しました:', error));
});

// 添加已选标签的辅助函数
function addSelectedTag(tagId, tagName, tagColor) {
    const selectedTagsContainer = document.getElementById('selectedTags');
    const tagElement = document.createElement('span');
    tagElement.className = 'selected-tag';
    tagElement.style.backgroundColor = tagColor;
    tagElement.innerHTML = `
        #${tagName}
        <span class="remove-tag" data-tag-id="${tagId}">&times;</span>
    `;
    selectedTagsContainer.appendChild(tagElement);
    selectedTags.add(tagId);
}

// 处理移除标签
document.getElementById('selectedTags').addEventListener('click', function (e) {
    if (e.target.classList.contains('remove-tag')) {
        const tagId = e.target.dataset.tagId;
        selectedTags.delete(Number(tagId));
        e.target.parentElement.remove();
    }
});

// 启动自动刷新
function startAutoRefresh() {
    // 清除可能存在的旧定时器
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    // 每3秒刷新一次
    autoRefreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {  // 只在页面可见时刷新
            window.apiCall(`/forum/api/posts?page=${currentPage}&per_page=20${currentFilterTag ? `&tag_id=${currentFilterTag}` : ''}`)
                .then(response => response.json())
                .then(data => {
                    if (!data.posts) return;

                    const postsContainer = document.querySelector('.posts-container');
                    const currentPosts = postsContainer.children;

                    // 比较新旧帖子，只更新发生变化的部分
                    data.posts.forEach((newPost, index) => {
                        const existingPostCard = currentPosts[index];
                        const newPostCard = createPostCard(newPost);

                        if (!existingPostCard) {
                            // 如果是新增的帖子，添加到列表中
                            postsContainer.appendChild(newPostCard);
                        } else {
                            // 比较帖子内容、标题、时间和回复数是否相同
                            const existingContent = existingPostCard.querySelector('.post-content').textContent;
                            const existingTitle = existingPostCard.querySelector('.post-title').textContent;
                            const existingTime = existingPostCard.querySelector('.post-time').textContent;
                            const existingComments = existingPostCard.querySelector('.post-comments').textContent;
                            const newCommentsText = `${newPost.comment_count} 件の返信`;

                            if (existingContent !== newPost.content ||
                                existingTitle !== newPost.title ||
                                formatDate(newPost.created_at) !== existingTime ||
                                existingComments !== newCommentsText) {

                                // 如果只有回复数变化，只更新回复数
                                if (existingContent === newPost.content &&
                                    existingTitle === newPost.title &&
                                    formatDate(newPost.created_at) === existingTime) {
                                    existingPostCard.querySelector('.post-comments').textContent = newCommentsText;
                                } else {
                                    // 如果其他内容也变化，替换整个卡片
                                    existingPostCard.replaceWith(newPostCard);
                                }
                            }
                        }
                    });

                    // 更新分页信息，但保持当前页面状态
                    const paginationContainer = document.querySelector('.pagination');
                    if (data.total !== parseInt(paginationContainer.dataset.total)) {
                        createPagination(data.total, data.pages, currentPage, paginationContainer);
                        paginationContainer.dataset.total = data.total;
                    }
                })
                .catch(error => console.error('投稿の読み込みに失敗しました:', error));
        }
    }, 3000);
}

// 停止自动刷新
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // 页面变为可见时，立即刷新一次并重启自动刷新
        loadPosts(1);
        startAutoRefresh();
    } else {
        // 页面不可见时，停止自动刷新
        stopAutoRefresh();
    }
}); 