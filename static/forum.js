// 全局变量
let currentPage = 1;
let currentPostId = null;
let currentPopupCloseHandler = null;  // 添加全局变量来跟踪当前的点击外部关闭处理器
let postDetailUpdateInterval = null;  // 添加更新计时器变量

// 统一的用户信息显示函数
function showUserInfo(userId, clickEvent) {
    if (!userId) {
        console.error('No userId provided');
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

    fetch(`/forum/api/user/${userId}`)
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
    fetch(`/forum/api/user/${userId}/posts`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const postsContainer = document.getElementById('forumPopupPosts');
                postsContainer.innerHTML = '';

                if (data.posts.length === 0) {
                    postsContainer.innerHTML = '<div class="no-posts">暂无发帖</div>';
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
        return '刚刚';
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < week) {
        return `${Math.floor(diff / day)}天前`;
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

    fetch(`/forum/api/posts?page=${page}&per_page=20`)
        .then(response => response.json())
        .then(data => {
            postsContainer.innerHTML = '';
            data.posts.forEach(post => {
                const postCard = createPostCard(post);
                postsContainer.appendChild(postCard);
            });
            createPagination(data.total, data.pages, data.current_page, paginationContainer);
        })
        .catch(error => console.error('加载帖子失败:', error));
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
                <span class="post-comments">${post.comment_count} 回复</span>
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
    initializeForum();
});

// 创建分页控件
function createPagination(total, pages, currentPage, container) {
    container.innerHTML = '';
    if (pages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => loadPosts(currentPage - 1));
    container.appendChild(prevButton);

    for (let i = 1; i <= pages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = i === currentPage ? 'active' : '';
        button.addEventListener('click', () => loadPosts(i));
        container.appendChild(button);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
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

    fetch(`/forum/api/posts/${currentPostId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('加载帖子详情失败');
            }
            return response.json();
        })
        .then(post => {
            if (post.error) {
                console.error('加载帖子详情失败:', post.error);
                return;
            }

            // 更新帖子内容
            document.getElementById('postTitle').textContent = post.title;
            document.getElementById('postContent').textContent = post.content;
            document.getElementById('postAuthor').textContent = post.author_name;
            document.getElementById('postTime').textContent = formatDate(post.created_at);

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
            console.error('加载帖子详情失败:', error);
        });
}

// 加载评论
function loadComments(postId) {
    if (!postId) {
        console.error('无效的帖子ID');
        return;
    }

    fetch(`/forum/api/posts/${postId}/comments`)
        .then(response => {
            if (!response.ok) {
                throw new Error('加载评论失败');
            }
            return response.json();
        })
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
            console.error('加载评论失败:', error);
        });
}

// 处理新建帖子表单提交
function handleNewPostSubmit(e) {
    e.preventDefault();
    const title = this.querySelector('[name="title"]').value.trim();
    const content = this.querySelector('[name="content"]').value.trim();

    if (!title || !content) {
        return;
    }

    fetch('/forum/api/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, content })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('帖子创建失败');
            }
            return response.json();
        })
        .then(post => {
            if (post.error) {
                console.error('帖子创建失败:', post.error);
                return;
            }
            // 关闭模态框
            const modal = document.getElementById('newPostModal');
            modal.style.display = 'none';
            // 重置表单
            this.reset();
            // 刷新帖子列表
            loadPosts(1);
        })
        .catch(error => {
            console.error('创建帖子失败:', error);
        });
}

// 处理新建评论表单提交
function handleNewCommentSubmit(e) {
    e.preventDefault();

    if (!currentPostId) {
        console.error('没有选中的帖子ID');
        return;
    }

    const contentInput = this.querySelector('[name="content"]');
    const content = contentInput.value.trim();
    if (!content) {
        return;
    }

    fetch(`/forum/api/posts/${currentPostId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('评论创建失败');
            }
            return response.json();
        })
        .then(comment => {
            if (comment.error) {
                console.error('评论创建失败:', comment.error);
                return;
            }

            // 清空输入框
            contentInput.value = '';

            // 创建并添加新评论到评论列表
            const commentsContainer = document.getElementById('commentsContainer');
            const commentElement = createCommentElement(comment);
            commentsContainer.appendChild(commentElement);

            // 滚动到新评论
            commentElement.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            console.error('创建评论失败:', error);
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