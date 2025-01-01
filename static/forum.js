document.addEventListener('DOMContentLoaded', function () {
    // 初始化论坛功能
    initializeForum();
});

function initializeForum() {
    const postsContainer = document.querySelector('.posts-container');
    const paginationContainer = document.querySelector('.pagination');
    let currentPage = 1;
    let currentPostId = null;

    // 加载帖子列表
    function loadPosts(page = 1) {
        fetch(`/forum/api/posts?page=${page}&per_page=20`)
            .then(response => response.json())
            .then(data => {
                postsContainer.innerHTML = '';
                data.posts.forEach(post => {
                    const postCard = createPostCard(post);
                    postsContainer.appendChild(postCard);
                });
                createPagination(data.total, data.pages, data.current_page);
            })
            .catch(error => console.error('加载帖子失败:', error));
    }

    // 创建帖子卡片
    function createPostCard(post) {
        const div = document.createElement('div');
        div.className = 'post-card';

        // 获取用户名首字母作为头像
        const initial = post.author_name ? post.author_name.charAt(0).toUpperCase() : '?';

        div.innerHTML = `
            <div class="post-header">
                <div class="post-avatar">${initial}</div>
                <span class="post-author">${post.author_name}</span>
                <span class="post-time">${formatDate(post.created_at)}</span>
            </div>
            <div class="post-title">${post.title}</div>
            <div class="post-content">${post.content}</div>
            <div class="post-footer">
                <span class="post-comments">${post.comment_count} 回复</span>
            </div>
        `;

        div.addEventListener('click', () => openPostDetail(post.id));
        return div;
    }

    // 创建分页控件
    function createPagination(total, pages, currentPage) {
        paginationContainer.innerHTML = '';
        if (pages <= 1) return;

        const prevButton = document.createElement('button');
        prevButton.textContent = '上一页';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => loadPosts(currentPage - 1));
        paginationContainer.appendChild(prevButton);

        for (let i = 1; i <= pages; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            button.className = i === currentPage ? 'active' : '';
            button.addEventListener('click', () => loadPosts(i));
            paginationContainer.appendChild(button);
        }

        const nextButton = document.createElement('button');
        nextButton.textContent = '下一页';
        nextButton.disabled = currentPage === pages;
        nextButton.addEventListener('click', () => loadPosts(currentPage + 1));
        paginationContainer.appendChild(nextButton);
    }

    // 打开帖子详情
    function openPostDetail(postId) {
        currentPostId = postId;
        const modal = document.getElementById('postDetailModal');
        modal.style.display = 'block';

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
                document.getElementById('postTitle').textContent = post.title;
                document.getElementById('postContent').textContent = post.content;
                document.getElementById('postAuthor').textContent = post.author_name;
                document.getElementById('postTime').textContent = formatDate(post.created_at);
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

    // 创建评论元素
    function createCommentElement(comment) {
        const div = document.createElement('div');
        div.className = 'comment';

        div.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${comment.author_name}</span>
                <span class="comment-time">${formatDate(comment.created_at)}</span>
            </div>
            <p class="comment-content">${comment.content}</p>
        `;
        return div;
    }

    // 格式化日期
    function formatDate(dateStr) {
        // 确保日期字符串格式正确
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

        // 添加补零函数
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

    // 初始化
    loadPosts();

    // 每5秒刷新一次
    setInterval(() => {
        loadPosts(currentPage);
        if (currentPostId) {
            loadComments(currentPostId);
        }
    }, 5000);

    // 处理新建帖子表单提交
    const newPostForm = document.getElementById('newPostForm');
    newPostForm.addEventListener('submit', function (e) {
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
    });

    // 处理新建评论表单提交
    const newCommentForm = document.getElementById('newCommentForm');
    newCommentForm.addEventListener('submit', function (e) {
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
            .then(comments => {
                if (comments.error) {
                    console.error('评论创建失败:', comments.error);
                    return;
                }

                // 清空输入框
                contentInput.value = '';

                // 添加新评论到评论列表
                const commentsContainer = document.getElementById('commentsContainer');
                comments.forEach(comment => {
                    const commentElement = createCommentElement(comment);
                    commentsContainer.appendChild(commentElement);
                });
            })
            .catch(error => {
                console.error('创建评论失败:', error);
            });
    });

    // 处理模态框关闭
    document.querySelectorAll('.close, .close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', function (e) {
            e.preventDefault();  // 防止按钮提交表单
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                // 如果是帖子详情模态框，重置状态
                if (modal.id === 'postDetailModal') {
                    currentPostId = null;
                    document.getElementById('commentsContainer').innerHTML = '';
                    document.getElementById('newCommentForm').reset();
                } else if (modal.id === 'newPostModal') {
                    document.getElementById('newPostForm').reset();
                }
            }
        });
    });

    // 点击模态框外部关闭
    window.addEventListener('click', function (e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            if (e.target.id === 'postDetailModal') {
                currentPostId = null;
                document.getElementById('commentsContainer').innerHTML = '';
                document.getElementById('newCommentForm').reset();
            } else if (e.target.id === 'newPostModal') {
                document.getElementById('newPostForm').reset();
            }
        }
    });
} 