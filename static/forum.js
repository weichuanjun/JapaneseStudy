// 全局变量
let currentPage = 1;
let currentPostId = null;
let hidePopupTimeout;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    console.log('Forum page initialized');
    initializeForum();
});

// 初始化论坛功能
function initializeForum() {
    // 加载帖子列表
    loadPosts();

    // 初始化事件监听
    initializeEventListeners();

    // 设置定时刷新
    setInterval(() => {
        loadPosts(currentPage);
        if (currentPostId) {
            loadComments(currentPostId);
        }
    }, 5000);
}

// 初始化事件监听
function initializeEventListeners() {
    // 新建帖子表单
    const newPostForm = document.getElementById('newPostForm');
    if (newPostForm) {
        newPostForm.addEventListener('submit', handleNewPost);
    }

    // 新建评论表单
    const newCommentForm = document.getElementById('newCommentForm');
    if (newCommentForm) {
        newCommentForm.addEventListener('submit', handleNewComment);
    }

    // 模态框关闭按钮
    document.querySelectorAll('.close, .close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', handleModalClose);
    });

    // 点击模态框外部关闭
    window.addEventListener('click', handleOutsideClick);

    // 用户信息弹窗
    initializeUserInfoPopup();
}

// 初始化用户信息弹窗
function initializeUserInfoPopup() {
    const popup = document.getElementById('forumUserInfoPopup');
    if (!popup) return;

    // 处理弹窗的鼠标事件
    popup.addEventListener('mouseenter', () => {
        if (hidePopupTimeout) {
            clearTimeout(hidePopupTimeout);
        }
    });

    popup.addEventListener('mouseleave', () => {
        hidePopupTimeout = setTimeout(() => {
            popup.classList.remove('show');
        }, 200);
    });

    // 处理全局点击事件
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !e.target.closest('.post-author')) {
            popup.classList.remove('show');
        }
    });
}

// 加载帖子列表
function loadPosts(page = 1) {
    console.log('Loading posts for page:', page);
    currentPage = page;

    fetch(`/forum/api/posts?page=${page}&per_page=20`)
        .then(response => response.json())
        .then(data => {
            const postsContainer = document.querySelector('.posts-container');
            postsContainer.innerHTML = '';

            data.posts.forEach(post => {
                const postCard = createPostCard(post);
                postsContainer.appendChild(postCard);
            });

            createPagination(data.total, data.pages, data.current_page);
        })
        .catch(error => console.error('Failed to load posts:', error));
}

// 创建帖子卡片
function createPostCard(post) {
    console.log('Creating post card:', post);
    const div = document.createElement('div');
    div.className = 'post-card';

    // 处理头像显示
    let avatarHtml;
    if (post.avatar_data) {
        avatarHtml = `<img src="${post.avatar_data}" alt="${post.author_name}">`;
    } else {
        const initial = post.author_name ? post.author_name.charAt(0).toUpperCase() : '?';
        avatarHtml = `<div class="default-avatar">${initial}</div>`;
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

    // 绑定事件
    bindPostCardEvents(div, post);

    return div;
}

// 绑定帖子卡片事件
function bindPostCardEvents(postCard, post) {
    // 用户信息弹窗事件
    const authorElement = postCard.querySelector('.post-author');
    authorElement.addEventListener('click', async function (e) {
        e.stopPropagation();
        const userId = this.dataset.userId;
        if (!userId) return;

        try {
            const response = await fetch(`/api/user/${userId}`);
            const data = await response.json();

            if (data.success) {
                showUserInfoPopup(data.user, this);
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
    });

    // 帖子点击事件
    const contentWrapper = postCard.querySelector('.post-content-wrapper');
    contentWrapper.addEventListener('click', function (e) {
        e.stopPropagation();
        openPostDetail(post.id);
    });
}

// 显示用户信息弹窗
function showUserInfoPopup(user, element) {
    const popup = document.getElementById('forumUserInfoPopup');
    if (!popup) return;

    // 更新弹窗内容
    document.getElementById('forumPopupUsername').textContent = user.username;
    document.getElementById('forumPopupJoinDate').textContent = `会員登録: ${user.created_at}`;
    document.getElementById('forumPopupReadingScore').textContent =
        (user.avg_reading_score || 0).toFixed(1);
    document.getElementById('forumPopupTopicScore').textContent =
        (user.avg_topic_score || 0).toFixed(1);
    document.getElementById('forumPopupTotalPractices').textContent =
        user.total_practices || 0;
    document.getElementById('forumPopupTotalStudyTime').textContent =
        `${user.total_study_time || 0}分`;
    document.getElementById('forumPopupStreakDays').textContent =
        `${user.streak_days || 0}日`;
    document.getElementById('forumPopupBirthday').textContent =
        user.birthday || '-';
    document.getElementById('forumPopupZodiac').textContent =
        user.zodiac_sign || '-';
    document.getElementById('forumPopupMBTI').textContent =
        user.mbti || '-';
    document.getElementById('forumPopupBio').textContent =
        user.bio || '-';

    // 处理头像显示
    const avatarImg = document.getElementById('forumPopupUserAvatar');
    const avatarInitial = document.getElementById('forumPopupUserInitial');

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

    // 计算弹窗位置
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupWidth = 300;
    const popupHeight = popup.offsetHeight || 400;
    const scrollY = window.scrollY;

    // 默认显示在左侧
    let left = rect.left - popupWidth - 10;

    // 如果左侧空间不足，则显示在右侧
    if (left < 10) {
        left = rect.right + 10;
        // 如果右侧也没有足够空间，则显示在元素下方
        if (left + popupWidth > viewportWidth - 10) {
            left = Math.max(10, rect.left);
            top = rect.bottom + 10;
        }
    }

    // 确保不超出右边界
    if (left + popupWidth > viewportWidth - 10) {
        left = viewportWidth - popupWidth - 10;
    }

    // 计算顶部位置，考虑滚动位置
    let top = rect.top + scrollY;

    // 如果弹窗会超出底部，则向上显示
    if (rect.top + popupHeight > viewportHeight - 10) {
        top = rect.bottom - popupHeight + scrollY;
    }

    // 确保不超出顶部
    if (top - scrollY < 10) {
        top = scrollY + 10;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.classList.add('show');

    // 添加点击外部关闭弹窗
    const closePopupOnOutsideClick = (e) => {
        if (!popup.contains(e.target) && !element.contains(e.target)) {
            popup.classList.remove('show');
            document.removeEventListener('click', closePopupOnOutsideClick);
        }
    };

    // 延迟添加事件监听，避免立即触发
    setTimeout(() => {
        document.addEventListener('click', closePopupOnOutsideClick);
    }, 0);
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
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    }
}

// 处理新建帖子
function handleNewPost(e) {
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
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Failed to create post:', data.error);
                return;
            }
            handleModalClose.call(document.querySelector('#newPostModal .close'));
            this.reset();
            loadPosts(1);
        })
        .catch(error => console.error('Failed to create post:', error));
}

// 处理新建评论
function handleNewComment(e) {
    e.preventDefault();
    if (!currentPostId) {
        console.error('No post selected');
        return;
    }

    const content = this.querySelector('[name="content"]').value.trim();
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
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Failed to create comment:', data.error);
                return;
            }
            this.reset();
            loadComments(currentPostId);
        })
        .catch(error => console.error('Failed to create comment:', error));
}

// 处理模态框关闭
function handleModalClose(e) {
    if (e) e.preventDefault();
    const modal = this.closest('.modal');
    if (modal) {
        modal.style.display = 'none';
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
function handleOutsideClick(e) {
    if (e.target.classList.contains('modal')) {
        handleModalClose.call(e.target.querySelector('.close'));
    }
}

// 创建分页控件
function createPagination(total, pages, currentPage) {
    const container = document.querySelector('.pagination');
    container.innerHTML = '';

    if (pages <= 1) return;

    // 上一页按钮
    const prevButton = document.createElement('button');
    prevButton.textContent = '前へ';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => loadPosts(currentPage - 1));
    container.appendChild(prevButton);

    // 页码按钮
    for (let i = 1; i <= pages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = i === currentPage ? 'active' : '';
        button.addEventListener('click', () => loadPosts(i));
        container.appendChild(button);
    }

    // 下一页按钮
    const nextButton = document.createElement('button');
    nextButton.textContent = '次へ';
    nextButton.disabled = currentPage === pages;
    nextButton.addEventListener('click', () => loadPosts(currentPage + 1));
    container.appendChild(nextButton);
}

// 打开帖子详情
function openPostDetail(postId) {
    currentPostId = postId;
    const modal = document.getElementById('postDetailModal');
    modal.style.display = 'block';

    fetch(`/forum/api/posts/${postId}`)
        .then(response => response.json())
        .then(post => {
            if (post.error) {
                console.error('Failed to load post details:', post.error);
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

            // 加载评论
            loadComments(postId);
        })
        .catch(error => console.error('Failed to load post details:', error));
}

// 加载评论
function loadComments(postId) {
    if (!postId) {
        console.error('Invalid post ID');
        return;
    }

    fetch(`/forum/api/posts/${postId}/comments`)
        .then(response => response.json())
        .then(comments => {
            const container = document.getElementById('commentsContainer');
            container.innerHTML = '';

            if (Array.isArray(comments)) {
                comments.forEach(comment => {
                    const element = createCommentElement(comment);
                    container.appendChild(element);
                });
            }
        })
        .catch(error => console.error('Failed to load comments:', error));
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
        avatarHtml = `<div class="default-avatar">${initial}</div>`;
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
        <div class="comment-content">${comment.content}</div>
    `;

    // 绑定用户信息弹窗事件
    const authorElement = div.querySelector('.comment-author');
    authorElement.addEventListener('click', async function (e) {
        e.stopPropagation();
        const userId = this.dataset.userId;
        if (!userId) return;

        try {
            const response = await fetch(`/api/user/${userId}`);
            const data = await response.json();

            if (data.success) {
                showUserInfoPopup(data.user, this);
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
    });

    return div;
}

// 其他函数保持不变... 