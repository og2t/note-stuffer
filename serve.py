#!/usr/bin/env python3
# Static server that disables caching so edits show up on a normal reload
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8642
http.server.ThreadingHTTPServer(('0.0.0.0', port), NoCache).serve_forever()
