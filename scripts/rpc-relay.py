#!/usr/bin/env python3
"""Localhost relay so the Stellar CLI can reach testnet from a cloud session.

The CLI's RPC client (jsonrpsee) ignores HTTPS_PROXY, and cloud sessions only
allow outbound traffic through that proxy. This relay accepts plain HTTP on
127.0.0.1 and forwards each request over HTTPS through HTTPS_PROXY (urllib
reads it, and SSL_CERT_FILE supplies the proxy's CA), so the environment's
egress policy still applies to every request.

  POST /           -> https://soroban-testnet.stellar.org/  (JSON-RPC)
  GET  /friendbot  -> https://friendbot.stellar.org/        (funding)

getNetwork responses get their friendbotUrl pointed back at this relay, since
the CLI's own HTTP client may not trust the proxy's CA.

Usage: python3 scripts/rpc-relay.py [port]   (default 8001)
"""
import json
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RPC = "https://soroban-testnet.stellar.org/"
FRIENDBOT = "https://friendbot.stellar.org/"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
LOCAL = f"http://127.0.0.1:{PORT}"


class Relay(BaseHTTPRequestHandler):
    def _forward(self, url, method, body=None):
        req = urllib.request.Request(url, data=body, method=method)
        # Testnet's Cloudflare rejects urllib's default User-Agent (error 1010).
        req.add_header("User-Agent", "stellar-cli-relay/1.0")
        if body is not None:
            req.add_header("Content-Type", self.headers.get("Content-Type", "application/json"))
        for h in ("X-Client-Name", "X-Client-Version"):
            if self.headers.get(h):
                req.add_header(h, self.headers[h])
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.status, resp.headers.get("Content-Type", "application/json"), resp.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers.get("Content-Type", "application/json"), e.read()

    def _reply(self, status, ctype, data):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        status, ctype, data = self._forward(RPC, "POST", body)
        try:
            msg = json.loads(data)
            if isinstance(msg, dict) and isinstance(msg.get("result"), dict) and "friendbotUrl" in msg["result"]:
                msg["result"]["friendbotUrl"] = f"{LOCAL}/friendbot"
                data = json.dumps(msg).encode()
        except ValueError:
            pass
        self._reply(status, ctype, data)

    def do_GET(self):
        if self.path.startswith("/friendbot"):
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            self._reply(*self._forward(f"{FRIENDBOT}?{query}", "GET"))
        else:
            self._reply(404, "text/plain", b"not found\n")

    def log_message(self, fmt, *args):
        sys.stderr.write("relay: " + fmt % args + "\n")


if __name__ == "__main__":
    print(f"relaying {LOCAL} -> {RPC} (and /friendbot) via HTTPS_PROXY", file=sys.stderr)
    ThreadingHTTPServer(("127.0.0.1", PORT), Relay).serve_forever()
