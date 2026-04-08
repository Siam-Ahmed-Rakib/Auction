import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())

import uvicorn
uvicorn.run("app.main:socket_app", host="0.0.0.0", port=5001)
