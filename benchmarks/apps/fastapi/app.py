from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse

app = FastAPI()


@app.middleware("http")
async def add_scope(request: Request, call_next):
    if request.url.path.startswith("/api/v1/users/"):
        request.state.scope = "user"

    return await call_next(request)


@app.get("/healthz")
async def healthz():
    return PlainTextResponse("ok")


@app.get("/plaintext")
async def plaintext():
    return PlainTextResponse("Hello, World!")


@app.get("/json")
async def json_route():
    return JSONResponse({"message": "Hello, World!", "ok": True})


@app.get("/time_json")
async def time_json():
    now = datetime.now().astimezone()
    return JSONResponse(
        {
            "localTime": now.isoformat(),
            "unixMs": int(now.timestamp() * 1000),
            "timezoneOffsetMinutes": int(now.utcoffset().total_seconds() // 60),
        }
    )


@app.get("/api/v1/users/{user_id}/profile")
async def user_profile(user_id: str, request: Request):
    return JSONResponse(
        {
            "id": user_id,
            "scope": getattr(request.state, "scope", "missing"),
            "active": True,
        }
    )
