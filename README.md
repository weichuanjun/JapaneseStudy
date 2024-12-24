虚拟环境
python -m venv venv

启动虚拟环境 mac
source venv/bin/activate

pip install -r requirements.txt

启动 flask
set FLASK_APP=application.py
set FLASK_ENV=development
flask run
flask --app application.py run