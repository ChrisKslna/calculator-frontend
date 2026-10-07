"""Local static frontend and /api proxy; production uses Nginx instead."""

import argparse
import http.client
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class FrontendHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(
            *args, directory=str(Path(__file__).parent / "src"), **kwargs
        )

    def proxy_api(self):
        connection = http.client.HTTPConnection(
            "127.0.0.1", self.server.backend_port, timeout=12
        )
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 0 or size > 16384:
                self.json_error(413, "请求内容过长。")
                return
            body = self.rfile.read(size) if size else None
            connection.request(self.command, self.path, body=body, headers={
                "Content-Type": self.headers.get("Content-Type", ""),
            })
            response = connection.getresponse()
            data = response.read()
            self.send_response(response.status)
            for header in ("Content-Type", "Allow"):
                value = response.getheader(header)
                if value:
                    self.send_header(header, value)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (OSError, http.client.HTTPException):
            self.json_error(502, "暂时连接不到计算服务，请稍后重试。")
        except ValueError:
            self.json_error(400, "请求格式不正确。")
        finally:
            connection.close()

    def json_error(self, status, message):
        data = json.dumps({"success": False, "message": message}).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.proxy_api()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self.proxy_api()
        else:
            self.json_error(405, "仅 API 接受 POST 请求。")

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            self.proxy_api()
        else:
            self.json_error(405, "仅 API 接受 DELETE 请求。")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--backend-port", type=int, default=5000)
    options = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", options.port), FrontendHandler)
    server.backend_port = options.backend_port
    print(f"Frontend: http://127.0.0.1:{options.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
