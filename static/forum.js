// 全局变量
let currentPage = 1;
let currentPostId = null;

// 统一的用户信息显示函数
function showUserInfo(userId) {
    if (!userId) return;

    fetch(`/forum/api/user/${userId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const user = data.user;
                const popup = document.getElementById('forumUserInfoPopup');

                // 更新弹窗内容
                document.getElementById('forumPopupUsername').textContent = user.username;
                document.getElementById('forumPopupJoinDate').textContent = `会員登録: ${user.created_at}`;
                document.getElementById('forumPopupReadingScore').textContent = (user.avg_reading_score || 0).toFixed(1);
                document.getElementById('forumPopupTopicScore').textContent = (user.avg_topic_score || 0).toFixed(1);
                document.getElementById('forumPopupBirthday').textContent = user.birthday || '-';
                document.getElementById('forumPopupMBTI').textContent = user.mbti || '-';
                document.getElementById('forumPopupPostCount').textContent = user.post_count || 0;
                document.getElementById('forumPopupCommentCount').textContent = user.comment_count || 0;
                document.getElementById('forumPopupBio').textContent = user.bio || '-';

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

                // 设置弹窗位置为左侧固定位置
                popup.style.left = '20px';
                popup.style.top = '50%';
                popup.style.transform = 'translateY(-50%)';
                popup.classList.add('show');

                // 添加点击外部关闭功能
                document.addEventListener('click', function closePopup(e) {
                    if (!popup.contains(e.target) && !e.target.closest('.post-author')) {
                        popup.classList.remove('show');
                        document.removeEventListener('click', closePopup);
                    }
                });
            }
        })
        .catch(error => console.error('Error fetching user info:', error));
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
        e.stopPropagation();
        const userId = this.dataset.userId;
        showUserInfo(userId);
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
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    initializeForum();
    initializeUserInfoPopup();
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
        showUserInfo(userId);
    });

    return div;
}

// 打开帖子详情
function openPostDetail(postId) {
    currentPostId = postId;
    const modal = document.getElementById('postDetailModal');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');

    fetch(`/forum/api/posts/${postId}`)
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
                showUserInfo(userId);
            });

            loadComments(postId);
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
    e.preventDefault();  // 防止按钮提交表单
    const modal = this.closest('.modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
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
        if (e.target.id === 'postDetailModal') {
            currentPostId = null;
            document.getElementById('commentsContainer').innerHTML = '';
            document.getElementById('newCommentForm').reset();
        } else if (e.target.id === 'newPostModal') {
            document.getElementById('newPostForm').reset();
        }
    }
}

// 初始化用户信息弹窗
function initializeUserInfoPopup() {
    const userInfoPopup = document.getElementById('forumUserInfoPopup');
    if (!userInfoPopup) return;

    // 设置默认头像颜色
    document.querySelectorAll('.default-avatar').forEach(avatar => {
        const username = avatar.textContent.trim();
        if (username) {
            avatar.style.setProperty('--avatar-color', getRandomColor(username));
        }
    });

    // 处理弹窗的点击事件
    document.addEventListener('click', (e) => {
        const authorElement = e.target.closest('.post-author');
        if (authorElement) {
            e.stopPropagation();
            const userId = authorElement.dataset.userId;
            if (userId) {
                showUserInfo(userId);
            }
        } else if (!userInfoPopup.contains(e.target)) {
            userInfoPopup.classList.remove('show');
        }
    });
} 