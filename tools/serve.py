from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8766); args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
    def do_GET(self):
        if not self.path.split('?',1)[0].startswith(('/demo/','/tests/','/extension/')):
            self.send_error(404); return
        return super().do_GET()
    def log_message(self,format,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
print(f'Local demo ready at http://127.0.0.1:{args.port}/demo/',flush=True)
server.serve_forever()
