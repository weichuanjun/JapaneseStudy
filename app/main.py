from flask import Blueprint, render_template, session, redirect, url_for, request
from app.models import db, User
from functools import wraps

main_bp = Blueprint('main', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@main_bp.route('/')
@main_bp.route('/index')
@login_required
def index():
    active_tab = request.args.get('active_tab', 'dashboard')
    current_user = User.query.get(session['user_id'])
    return render_template('index.html', 
                         active_tab=active_tab, 
                         current_user=current_user) 