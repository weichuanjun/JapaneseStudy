try:
    import unzip_requirements
except ImportError:
    pass

import serverless_wsgi
from app.application import app 


def handle(event, context):
    """Lambda handler function"""
    return serverless_wsgi.handle_request(app, event, context) 