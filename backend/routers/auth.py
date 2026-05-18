"""routers/auth.py — FLX v2 auth with JWT middleware"""
import hashlib, os, time, base64, hmac, json
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Header
from models.database import get_db
from models.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter()
SECRET = os.getenv("FLX_SECRET", "flx-dev-secret-change-in-production")


def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _make_token(user_id: int, username: str) -> str:
    header  = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode()
    exp     = int(time.time()) + 7 * 24 * 3600
    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": user_id, "username": username, "exp": exp}).encode()
    ).decode()
    sig = hmac.new(SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).hexdigest()
    return f"{header}.{payload}.{sig}"


def verify_token(token: str) -> dict | None:
    try:
        header, payload, sig = token.split(".")
        expected = hmac.new(SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).hexdigest()
        if sig != expected:
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=="))
        if data["exp"] < time.time():
            return None
        return data
    except Exception:
        return None


# ── Dependency: inject current user from Authorization header ─────────────────
async def current_user(
    authorization: str = Header(None),
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    data = verify_token(token)
    if not data:
        raise HTTPException(401, "Token invalid or expired")
    cur = await db.execute("SELECT id, username, avatar, is_verified FROM users WHERE id=?", (data["sub"],))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(401, "User not found")
    return {"id": row["id"], "username": row["username"], "avatar": row["avatar"], "is_verified": bool(row["is_verified"])}


# ── Optional auth (returns None if not logged in) ─────────────────────────────
async def optional_user(authorization: str = Header(None)) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    return verify_token(token)


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id FROM users WHERE username=? OR email=?", (body.username, body.email))
    if await cur.fetchone():
        raise HTTPException(400, "Username or email already taken")
    await db.execute(
        "INSERT INTO users (username,email,password_hash,avatar) VALUES (?,?,?,?)",
        (body.username, body.email, _hash(body.password), body.username[:2].upper()),
    )
    await db.commit()
    cur = await db.execute("SELECT id FROM users WHERE username=?", (body.username,))
    uid = (await cur.fetchone())["id"]
    return TokenResponse(access_token=_make_token(uid, body.username), user_id=uid, username=body.username, avatar=body.username[:2].upper())


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        "SELECT id, username, password_hash, avatar, is_verified FROM users WHERE username=?", (body.username,)
    )
    row = await cur.fetchone()
    if not row or row["password_hash"] != _hash(body.password):
        raise HTTPException(401, "Invalid credentials")
    return TokenResponse(
        access_token=_make_token(row["id"], row["username"]),
        user_id=row["id"],
        username=row["username"],
        avatar=row["avatar"],
        is_verified=bool(row["is_verified"]),
    )


@router.get("/me")
async def me(user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        "SELECT id,username,avatar,rep_score,is_verified,location,bio,total_sales,total_buys,created_at FROM users WHERE id=?",
        (user["id"],)
    )
    row = await cur.fetchone()
    return dict(row)