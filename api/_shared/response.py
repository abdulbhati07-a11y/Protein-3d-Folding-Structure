"""HTTP response helpers for Vercel serverless functions."""
import json
from http.server import BaseHTTPRequestHandler

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
}


def json_response(handler: BaseHTTPRequestHandler, status: int, body: dict):
    payload = json.dumps(body).encode()
    handler.send_response(status)
    for k, v in CORS_HEADERS.items():
        handler.send_header(k, v)
    handler.send_header('Content-Length', str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def options_response(handler: BaseHTTPRequestHandler):
    handler.send_response(204)
    for k, v in CORS_HEADERS.items():
        handler.send_header(k, v)
    handler.end_headers()
