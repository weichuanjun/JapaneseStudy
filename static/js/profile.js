document.addEventListener('DOMContentLoaded', function () {
    // 头像预览
    const avatarInput = document.getElementById('avatar');
    const avatarPreview = document.getElementById('avatar-img');

    avatarInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                avatarPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // 表单提交
    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = new FormData(profileForm);

        try {
            const response = await fetch('/api/profile', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                alert('プロフィールが更新されました。');
                location.reload();
            } else {
                alert('エラーが発生しました：' + (result.error || '不明なエラー'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('エラーが発生しました。');
        }
    });
});

// 用户信息弹窗功能
const modal = document.getElementById('user-info-modal');
const closeBtn = document.querySelector('.close');

// 关闭弹窗
closeBtn.onclick = function () {
    modal.style.display = "none";
}

// 点击弹窗外部关闭
window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// 显示用户信息弹窗
async function showUserInfo(userId) {
    try {
        const response = await fetch(`/api/user/${userId}`);
        const userData = await response.json();

        // 更新弹窗内容
        document.getElementById('modal-avatar').src = userData.avatar_path ?
            `/static/${userData.avatar_path}` :
            '/static/images/default-avatar.png';
        document.getElementById('modal-username').textContent = userData.username;
        document.getElementById('modal-bio').textContent = userData.bio || '自己紹介はありません';
        document.getElementById('modal-zodiac').textContent = userData.zodiac_sign || '未設定';
        document.getElementById('modal-mbti').textContent = userData.mbti || '未設定';
        document.getElementById('modal-streak').textContent = `${userData.streak_days}日`;
        document.getElementById('modal-practices').textContent = userData.total_practices;
        document.getElementById('modal-reading-score').textContent = userData.avg_reading_score;
        document.getElementById('modal-topic-score').textContent = userData.avg_topic_score;

        // 显示弹窗
        modal.style.display = "block";
    } catch (error) {
        console.error('Error:', error);
        alert('ユーザー情報の取得に失敗しました。');
    }
}

// 为所有用户头像添加点击事件
document.addEventListener('DOMContentLoaded', function () {
    const userAvatars = document.querySelectorAll('.user-avatar[data-user-id]');
    userAvatars.forEach(avatar => {
        avatar.addEventListener('click', function () {
            const userId = this.getAttribute('data-user-id');
            showUserInfo(userId);
        });
    });
}); 