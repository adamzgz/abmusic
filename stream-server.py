"""
Local stream URL resolver — runs on host, emulator connects via 10.0.2.2:3333.
Uses yt-dlp to get working audio stream URLs from YouTube.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import sys

PORT = 3333

class StreamHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # /stream/<videoId>
        if self.path.startswith('/stream/'):
            video_id = self.path.split('/stream/')[1].split('?')[0]
            self.resolve_stream(video_id)
        else:
            self.send_response(404)
            self.end_headers()

    def resolve_stream(self, video_id):
        try:
            url = f'https://www.youtube.com/watch?v={video_id}'
            result = subprocess.run(
                [sys.executable, '-m', 'yt_dlp',
                 '--js-runtimes', 'node',
                 '-f', 'bestaudio[ext=m4a]/bestaudio',
                 '-g', url],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0:
                self.send_json(500, {'error': result.stderr.strip()})
                return

            stream_url = result.stdout.strip()
            print(f'[OK] {video_id} -> {len(stream_url)} chars')
            self.send_json(200, {'url': stream_url, 'videoId': video_id})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        print(f'[{self.address_string()}] {format % args}')

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), StreamHandler)
    print(f'Stream server running on http://0.0.0.0:{PORT}')
    print(f'Emulator connects via http://10.0.2.2:{PORT}/stream/<videoId>')
    server.serve_forever()
