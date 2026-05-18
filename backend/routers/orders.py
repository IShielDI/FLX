"""
routers/orders.py
─────────────────
Order history, bid management, wishlist.
"""

import json
from typing import List

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from models.database import get_db
from models.schemas import OrderOut

router = APIRouter()


# ── GET /api/orders  (for a user) ─────────────────────────────────────────────
@router.get("/", response_model=List[OrderOut])
async def list_orders(
    user_id: int = Query(1),
    db: aiosqlite.Connection = Depends(get_db),
):
    cur = await db.execute(
        "SELECT * FROM orders WHERE buyer_id=? ORDER BY created_at DESC", (user_id,)
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


# ── GET /api/orders/{id} ──────────────────────────────────────────────────────
@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT * FROM orders WHERE id=?", (order_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Order not found")
    return dict(row)


# ── GET /api/orders/bids/user  (active bids for a user) ──────────────────────
@router.get("/bids/user")
async def user_bids(user_id: int = Query(1), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT b.*, p.ticker, p.name, p.category
           FROM bids b JOIN products p ON b.product_id=p.id
           WHERE b.user_id=? ORDER BY b.created_at DESC""",
        (user_id,),
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


# ── DELETE /api/orders/bids/{id}  (cancel a bid) ─────────────────────────────
@router.delete("/bids/{bid_id}", status_code=200)
async def cancel_bid(bid_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id, status FROM bids WHERE id=?", (bid_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Bid not found")
    if row["status"] != "active":
        raise HTTPException(400, "Bid cannot be cancelled (already matched or cancelled)")
    await db.execute("UPDATE bids SET status='cancelled' WHERE id=?", (bid_id,))
    await db.commit()
    return {"status": "cancelled", "bid_id": bid_id}


# ── GET /api/orders/asks/user  (active listings / asks for a user) ────────────
@router.get("/asks/user")
async def user_asks(user_id: int = Query(1), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT a.*, p.ticker, p.name, p.category
           FROM asks a JOIN products p ON a.product_id=p.id
           WHERE a.user_id=? ORDER BY a.created_at DESC""",
        (user_id,),
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


# ── DELETE /api/orders/asks/{id}  (cancel / delist an ask) ───────────────────
@router.delete("/asks/{ask_id}", status_code=200)
async def cancel_ask(ask_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id, status FROM asks WHERE id=?", (ask_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Ask not found")
    if row["status"] == "sold":
        raise HTTPException(400, "Cannot cancel a sold listing")
    await db.execute("UPDATE asks SET status='cancelled' WHERE id=?", (ask_id,))
    await db.commit()
    return {"status": "cancelled", "ask_id": ask_id}


# ── Wishlist ─────────────────────────────────────────────────────────────────

@router.get("/wishlist/user")
async def get_wishlist(user_id: int = Query(1), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT p.id, p.ticker, p.name, p.ask, p.change_24h, p.image_url, p.category, p.slug
           FROM wishlist w JOIN products p ON w.product_id=p.id
           WHERE w.user_id=?""",
        (user_id,),
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/wishlist/{product_id}", status_code=201)
async def add_to_wishlist(
    product_id: int,
    user_id: int = Query(1),
    db: aiosqlite.Connection = Depends(get_db),
):
    try:
        await db.execute(
            "INSERT INTO wishlist (user_id, product_id) VALUES (?,?)", (user_id, product_id)
        )
        await db.commit()
    except Exception:
        pass  # already in wishlist — idempotent
    return {"status": "added", "product_id": product_id}


@router.delete("/wishlist/{product_id}", status_code=200)
async def remove_from_wishlist(
    product_id: int,
    user_id: int = Query(1),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute(
        "DELETE FROM wishlist WHERE user_id=? AND product_id=?", (user_id, product_id)
    )
    await db.commit()
    return {"status": "removed", "product_id": product_id}