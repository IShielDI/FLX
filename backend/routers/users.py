"""routers/users.py — FLX v2"""
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query
from models.database import get_db
from routers.auth import current_user

router = APIRouter()


@router.get("/me/profile")
async def my_profile(user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        "SELECT id,username,avatar,rep_score,is_verified,location,bio,total_sales,total_buys,created_at FROM users WHERE id=?",
        (user["id"],)
    )
    row = await cur.fetchone()
    if not row: raise HTTPException(404, "User not found")
    return dict(row)


@router.get("/{user_id}")
async def get_user(user_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        "SELECT id,username,avatar,rep_score,is_verified,location,bio,total_sales,total_buys,created_at FROM users WHERE id=?",
        (user_id,)
    )
    row = await cur.fetchone()
    if not row: raise HTTPException(404, "User not found")
    return dict(row)


@router.get("/{user_id}/storefront")
async def storefront(user_id: int, db: aiosqlite.Connection = Depends(get_db)):
    """Public seller page: active asks + stats."""
    cur = await db.execute(
        "SELECT id,username,avatar,rep_score,is_verified,location,total_sales FROM users WHERE id=?", (user_id,)
    )
    user = await cur.fetchone()
    if not user: raise HTTPException(404)
    cur2 = await db.execute(
        """SELECT a.id,a.size,a.price,a.created_at,p.ticker,p.name,p.image_url,p.category
           FROM asks a JOIN products p ON a.product_id=p.id
           WHERE a.user_id=? AND a.status='active' ORDER BY a.created_at DESC""",
        (user_id,)
    )
    listings = [dict(r) for r in await cur2.fetchall()]
    return {"user": dict(user), "listings": listings}


@router.get("/me/orders")
async def my_orders(user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT o.*,p.ticker,p.name,p.image_url,p.category
           FROM orders o JOIN products p ON o.product_id=p.id
           WHERE o.buyer_id=? ORDER BY o.created_at DESC""",
        (user["id"],)
    )
    return [dict(r) for r in await cur.fetchall()]


@router.get("/me/bids")
async def my_bids(user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT b.*,p.ticker,p.name,p.image_url,p.category
           FROM bids b JOIN products p ON b.product_id=p.id
           WHERE b.user_id=? AND b.status='active' ORDER BY b.created_at DESC""",
        (user["id"],)
    )
    return [dict(r) for r in await cur.fetchall()]


@router.delete("/me/bids/{bid_id}")
async def cancel_bid(bid_id: int, user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id,user_id,status FROM bids WHERE id=?", (bid_id,))
    row = await cur.fetchone()
    if not row: raise HTTPException(404)
    if row["user_id"] != user["id"]: raise HTTPException(403)
    if row["status"] != "active": raise HTTPException(400, "Already matched or cancelled")
    await db.execute("UPDATE bids SET status='cancelled' WHERE id=?", (bid_id,))
    await db.commit()
    return {"status": "cancelled"}


@router.get("/me/asks")
async def my_asks(user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT a.*,p.ticker,p.name,p.image_url,p.category
           FROM asks a JOIN products p ON a.product_id=p.id
           WHERE a.user_id=? AND a.status='active' ORDER BY a.created_at DESC""",
        (user["id"],)
    )
    return [dict(r) for r in await cur.fetchall()]


@router.delete("/me/asks/{ask_id}")
async def cancel_ask(ask_id: int, user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id,user_id,status FROM asks WHERE id=?", (ask_id,))
    row = await cur.fetchone()
    if not row: raise HTTPException(404)
    if row["user_id"] != user["id"]: raise HTTPException(403)
    if row["status"] == "sold": raise HTTPException(400, "Already sold")
    await db.execute("UPDATE asks SET status='cancelled' WHERE id=?", (ask_id,))
    await db.commit()
    return {"status": "cancelled"}


@router.get("/me/wishlist")
async def get_wishlist(user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT p.id,p.ticker,p.name,p.ask,p.change_24h,p.image_url,p.category,p.slug,p.is_verified
           FROM wishlist w JOIN products p ON w.product_id=p.id WHERE w.user_id=?""",
        (user["id"],)
    )
    return [dict(r) for r in await cur.fetchall()]


@router.post("/me/wishlist/{product_id}", status_code=201)
async def add_wishlist(product_id: int, user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    try:
        await db.execute("INSERT INTO wishlist (user_id,product_id) VALUES (?,?)", (user["id"], product_id))
        await db.commit()
    except Exception:
        pass
    return {"status": "added"}


@router.delete("/me/wishlist/{product_id}")
async def remove_wishlist(product_id: int, user: dict = Depends(current_user), db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM wishlist WHERE user_id=? AND product_id=?", (user["id"], product_id))
    await db.commit()
    return {"status": "removed"}