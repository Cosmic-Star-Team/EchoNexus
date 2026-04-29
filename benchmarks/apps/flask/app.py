from datetime import datetime

from flask import Flask, Response, g, jsonify, request

app = Flask(__name__)


@app.before_request
def add_scope():
    if request.path.startswith("/api/v1/users/"):
        g.scope = "user"


@app.get("/healthz")
def healthz():
    return Response("ok", mimetype="text/plain")


@app.get("/plaintext")
def plaintext():
    return Response("Hello, World!", mimetype="text/plain")


@app.get("/json")
def json_route():
    return jsonify({"message": "Hello, World!", "ok": True})


@app.get("/time_json")
def time_json():
    now = datetime.now().astimezone()
    return jsonify(
        {
            "localTime": now.isoformat(),
            "unixMs": int(now.timestamp() * 1000),
            "timezoneOffsetMinutes": int(now.utcoffset().total_seconds() // 60),
        }
    )


@app.get("/api/v1/users/<user_id>/profile")
def user_profile(user_id: str):
    return jsonify(
        {
            "id": user_id,
            "scope": getattr(g, "scope", "missing"),
            "active": True,
        }
    )
