"""routers/community.py — FLX v2"""
from typing import List, Optional
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query
from models.database import get_db
from models.schemas import CommentOut, CreateCommentRequest, CreatePostRequest, PostOut
from routers.auth import current_user

router = APIRouter()


def _time_ago(ts: str) -> str:
    from datetime import datetime, timezone
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        diff = int((datetime.now(timezone.utc) - dt).total_seconds())
        if diff < 60:    return f"{diff}s ago"
        if diff < 3600:  return f"{diff//60}m ago"
        if diff < 86400: return f"{diff//3600}h ago"
        return f"{diff//86400}d ago"
    except Exception:
        return "recently"


async def _enrich(row, db) -> dict:
    cur = await db.execute(
        "SELECT username, avatar, rep_score, is_verified FROM users WHERE id=?", (row["user_id"],)
    )
    u = await cur.fetchone()
    cur2 = await db.execute("SELECT COUNT(*) FROM post_comments WHERE post_id=?", (row["id"],))
    comments = (await cur2.fetchone())[0]
    return {
        "id":        row["id"],
        "user":      u["username"] if u else "unknown",
        "avatar":    u["avatar"] if u else "UN",
        "rep":       u["rep_score"] if u else 0,
        "is_verified": bool(u["is_verified"]) if u else False,
        "board":     row["board"],
        "type":      row["type"],
        "title":     row["title"],
        "body":      row["body"],
        "upvotes":   row["upvotes"],
        "downvotes": row["downvotes"],
        "comments":  comments,
        "time":      _time_ago(row["created_at"]),
        "hot":       bool(row["is_hot"]),
    }


@router.get("/posts", response_model=List[PostOut])
async def list_posts(
    board: Optional[str] = Query(None),
    sort:  Optional[str] = Query("hot"),
    limit: int = Query(30),
    db: aiosqlite.Connection = Depends(get_db),
):
    sql = "SELECT * FROM community_posts WHERE 1=1"
    params = []
    if board and board != "All":
        sql += " AND board=?"; params.append(board)
    order = {"hot": "is_hot DESC, upvotes DESC", "new": "created_at DESC", "top": "upvotes DESC"}.get(sort, "upvotes DESC")
    sql += f" ORDER BY {order} LIMIT ?"; params.append(limit)
    cur = await db.execute(sql, params)
    rows = await cur.fetchall()
    return [await _enrich(r, db) for r in rows]


@router.post("/posts", status_code=201, response_model=PostOut)
async def create_post(
    body: CreatePostRequest,
    user: dict = Depends(current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cur = await db.execute(
        "INSERT INTO community_posts (user_id,board,type,title,body) VALUES (?,?,?,?,?)",
        (user["id"], body.board, body.type, body.title, body.body),
    )
    await db.commit()
    cur2 = await db.execute("SELECT * FROM community_posts WHERE id=?", (cur.lastrowid,))
    return await _enrich(await cur2.fetchone(), db)


@router.post("/posts/{post_id}/upvote")
async def upvote(post_id: int, user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("UPDATE community_posts SET upvotes=upvotes+1 WHERE id=?", (post_id,))
    await db.commit()
    cur = await db.execute("SELECT upvotes FROM community_posts WHERE id=?", (post_id,))
    row = await cur.fetchone()
    if not row: raise HTTPException(404, "Post not found")
    return {"upvotes": row["upvotes"]}


@router.post("/posts/{post_id}/downvote")
async def downvote(post_id: int, user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("UPDATE community_posts SET downvotes=downvotes+1 WHERE id=?", (post_id,))
    await db.commit()
    cur = await db.execute("SELECT upvotes,downvotes FROM community_posts WHERE id=?", (post_id,))
    return dict(await cur.fetchone())


@router.get("/posts/{post_id}/comments", response_model=List[CommentOut])
async def list_comments(post_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        "SELECT c.*,u.username,u.avatar,u.is_verified FROM post_comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=? ORDER BY c.created_at",
        (post_id,),
    )
    return [{"id": r["id"], "user": r["username"], "avatar": r["avatar"],
             "is_verified": bool(r["is_verified"]), "body": r["body"], "created_at": r["created_at"]}
            for r in await cur.fetchall()]


@router.post("/posts/{post_id}/comments", status_code=201, response_model=CommentOut)
async def add_comment(
    post_id: int,
    body: CreateCommentRequest,
    user: dict = Depends(current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cur = await db.execute(
        "INSERT INTO post_comments (post_id,user_id,body) VALUES (?,?,?)",
        (post_id, user["id"], body.body),
    )
    await db.commit()
    cur2 = await db.execute(
        "SELECT c.*,u.username,u.avatar,u.is_verified FROM post_comments c JOIN users u ON c.user_id=u.id WHERE c.id=?",
        (cur.lastrowid,),
    )
    r = await cur2.fetchone()
    return {"id": r["id"], "user": r["username"], "avatar": r["avatar"],
            "is_verified": bool(r["is_verified"]), "body": r["body"], "created_at": r["created_at"]}


@router.get("/stats")
async def community_stats(db: aiosqlite.Connection = Depends(get_db)):
    c1 = await db.execute("SELECT COUNT(*) FROM users")
    members = (await c1.fetchone())[0]
    c2 = await db.execute("SELECT COUNT(*) FROM community_posts WHERE created_at>datetime('now','-1 day')")
    today = (await c2.fetchone())[0]
    return {"members": members or 42810, "online_now": 1247, "posts_today": today or 384}