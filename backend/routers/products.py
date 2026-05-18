"""routers/products.py — FLX v2"""
import json, random, string
from typing import List, Optional
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from models.database import get_db
from models.schemas import (
    AskRequest, BidRequest, BuyRequest, MarketStats,
    OrderBook, OrderOut, PriceHistoryPoint, PriceTick,
    ProductOut, SellListingRequest, TickerSale,
)
from routers.auth import current_user

router = APIRouter()


def _lid() -> str:
    return "FLX-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def _row_to_product(row, base_url: str) -> dict:
    slug = row["slug"]
    image = row["image_url"] if row["image_url"] else f"{base_url}/images/{slug}.jpg"
    return {
        "id":           row["id"],
        "slug":         slug,
        "ticker":       row["ticker"],
        "name":         row["name"],
        "brand":        row["brand"],
        "category":     row["category"],
        "sku":          row["sku"] if "sku" in row.keys() else "",
        "colorway":     row["colorway"] if "colorway" in row.keys() else "",
        "release_date": row["release_date"] if "release_date" in row.keys() else "",
        "condition":    row["condition"] if "condition" in row.keys() else "New",
        "description":  row["description"] if "description" in row.keys() else "",
        "basePrice":    row["base_price"],
        "currentPrice": row["current_price"],
        "lastSold":     row["last_sold"],
        "bid":          row["bid"],
        "ask":          row["ask"],
        "change24h":    row["change_24h"],
        "volume":       row["volume"],
        "image":        image,
        "sizes":        json.loads(row["sizes"]),
        "verified":     bool(row["is_verified"]),
        "trending":     bool(row["is_trending"]),
    }


# ── GET /api/products/ ────────────────────────────────────────────────────────
@router.get("/", response_model=List[ProductOut])
async def list_products(
    request: Request,
    category: Optional[str] = Query(None),
    sort: Optional[str]     = Query("trending"),
    search: Optional[str]   = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    sql = "SELECT * FROM products WHERE 1=1"
    params: list = []
    if category and category != "All":
        sql += " AND category=?"; params.append(category)
    if search:
        like = f"%{search}%"
        sql += " AND (name LIKE ? OR ticker LIKE ? OR brand LIKE ? OR sku LIKE ?)"; params += [like, like, like, like]
    order_map = {
        "trending":   "is_trending DESC, change_24h DESC",
        "gainers":    "change_24h DESC",
        "losers":     "change_24h ASC",
        "price-asc":  "ask ASC",
        "price-desc": "ask DESC",
        "volume":     "volume DESC",
        "newest":     "id DESC",
    }
    sql += f" ORDER BY {order_map.get(sort, 'is_trending DESC, change_24h DESC')}"
    cur = await db.execute(sql, params)
    rows = await cur.fetchall()
    base = str(request.base_url).rstrip("/")
    return [_row_to_product(r, base) for r in rows]


# ── GET /api/products/{id} ────────────────────────────────────────────────────
@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, request: Request, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT * FROM products WHERE id=?", (product_id,))
    row = await cur.fetchone()
    if not row: raise HTTPException(404, "Product not found")
    return _row_to_product(row, str(request.base_url).rstrip("/"))


# ── GET /api/products/{id}/history ───────────────────────────────────────────
@router.get("/{product_id}/history", response_model=List[PriceHistoryPoint])
async def price_history(product_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        "SELECT rowid-1 AS day, price FROM price_history WHERE product_id=? ORDER BY recorded_at",
        (product_id,),
    )
    rows = await cur.fetchall()
    if not rows: raise HTTPException(404, "No history")
    # Normalize day index
    return [{"day": i, "price": r["price"]} for i, r in enumerate(rows)]


# ── GET /api/products/{id}/orderbook ─────────────────────────────────────────
@router.get("/{product_id}/orderbook")
async def orderbook(product_id: int, db: aiosqlite.Connection = Depends(get_db)):
    """Real order book: live bids + asks from the DB, joined with user info."""
    # Asks (sorted cheapest first)
    cur = await db.execute(
        """SELECT a.price, a.size, a.created_at, u.username, u.is_verified
           FROM asks a JOIN users u ON a.user_id=u.id
           WHERE a.product_id=? AND a.status='active'
           ORDER BY a.price ASC LIMIT 20""",
        (product_id,),
    )
    asks = [{"price": r["price"], "size": r["size"], "username": r["username"],
             "is_verified": bool(r["is_verified"]), "created_at": r["created_at"]}
            for r in await cur.fetchall()]

    # Bids (sorted highest first)
    cur2 = await db.execute(
        """SELECT b.amount AS price, b.size, b.created_at, u.username, u.is_verified
           FROM bids b JOIN users u ON b.user_id=u.id
           WHERE b.product_id=? AND b.status='active'
           ORDER BY b.amount DESC LIMIT 20""",
        (product_id,),
    )
    bids = [{"price": r["price"], "size": r["size"], "username": r["username"],
             "is_verified": bool(r["is_verified"]), "created_at": r["created_at"]}
            for r in await cur2.fetchall()]

    # Spread
    spread = (asks[0]["price"] - bids[0]["price"]) if asks and bids else 0

    # Recent sales for this product
    cur3 = await db.execute(
        """SELECT o.price, o.size, o.created_at, u.username
           FROM orders o JOIN users u ON o.buyer_id=u.id
           WHERE o.product_id=? ORDER BY o.created_at DESC LIMIT 10""",
        (product_id,),
    )
    recent = [{"price": r["price"], "size": r["size"], "created_at": r["created_at"],
               "username": r["username"]} for r in await cur3.fetchall()]

    return {"asks": asks, "bids": bids, "spread": spread, "recent_sales": recent}


# ── GET /api/products/{id}/sizes ─────────────────────────────────────────────
@router.get("/{product_id}/sizes")
async def size_market(product_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT ask, bid, last_sold, sizes FROM products WHERE id=?", (product_id,))
    row = await cur.fetchone()
    if not row: raise HTTPException(404, "Product not found")
    sizes = json.loads(row["sizes"])
    result = []
    for s in sizes:
        # Get real lowest ask for this size
        cur_a = await db.execute(
            "SELECT MIN(price) as p FROM asks WHERE product_id=? AND size=? AND status='active'",
            (product_id, s),
        )
        ra = await cur_a.fetchone()
        ask = ra["p"] if ra and ra["p"] else int(row["ask"] * random.uniform(0.9, 1.1))

        cur_b = await db.execute(
            "SELECT MAX(amount) as p FROM bids WHERE product_id=? AND size=? AND status='active'",
            (product_id, s),
        )
        rb = await cur_b.fetchone()
        bid = rb["p"] if rb and rb["p"] else int(row["bid"] * random.uniform(0.9, 1.1))

        last = int(row["last_sold"] * random.uniform(0.95, 1.05))
        result.append({"size": s, "ask": ask, "bid": bid, "lastSold": last, "trend": ask > row["ask"] * 0.98})
    return result


# ── POST /api/products/bids ───────────────────────────────────────────────────
@router.post("/bids", status_code=201)
async def place_bid(
    body: BidRequest,
    user: dict = Depends(current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cur = await db.execute("SELECT id, bid FROM products WHERE id=?", (body.product_id,))
    prod = await cur.fetchone()
    if not prod: raise HTTPException(404, "Product not found")
    cur2 = await db.execute(
        "INSERT INTO bids (product_id,user_id,size,amount) VALUES (?,?,?,?)",
        (body.product_id, user["id"], body.size, body.amount),
    )
    # Update best bid
    if body.amount > prod["bid"]:
        await db.execute("UPDATE products SET bid=?,updated_at=datetime('now') WHERE id=?", (body.amount, body.product_id))
    await db.commit()
    return {"status": "ok", "bid_id": cur2.lastrowid, "message": f"Bid of ₹{body.amount:,} placed for {body.size}"}


# ── POST /api/products/asks ───────────────────────────────────────────────────
@router.post("/asks", status_code=201)
async def place_ask(
    body: AskRequest,
    user: dict = Depends(current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cur = await db.execute("SELECT id, ask FROM products WHERE id=?", (body.product_id,))
    prod = await cur.fetchone()
    if not prod: raise HTTPException(404, "Product not found")
    cur2 = await db.execute(
        "INSERT INTO asks (product_id,user_id,size,price) VALUES (?,?,?,?)",
        (body.product_id, user["id"], body.size, body.price),
    )
    if body.price < prod["ask"]:
        await db.execute("UPDATE products SET ask=?,updated_at=datetime('now') WHERE id=?", (body.price, body.product_id))
    await db.commit()
    return {"status": "ok", "ask_id": cur2.lastrowid, "message": f"Ask of ₹{body.price:,} listed for {body.size}"}


# ── POST /api/products/buy ────────────────────────────────────────────────────
@router.post("/buy", status_code=201)
async def buy_now(
    body: BuyRequest,
    user: dict = Depends(current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cur = await db.execute("SELECT * FROM products WHERE id=?", (body.product_id,))
    prod = await cur.fetchone()
    if not prod: raise HTTPException(404, "Product not found")
    price   = prod["ask"]
    fee_flx = round(price * 0.095)
    fee_pay = round(price * 0.03)
    payout  = price - fee_flx - fee_pay
    lid     = _lid()
    cur2 = await db.execute(
        "INSERT INTO orders (buyer_id,product_id,size,price,fee_flx,fee_payment,payout,listing_id) VALUES (?,?,?,?,?,?,?,?)",
        (user["id"], body.product_id, body.size, price, fee_flx, fee_pay, payout, lid),
    )
    await db.execute(
        "UPDATE products SET last_sold=?,volume=volume+1,updated_at=datetime('now') WHERE id=?",
        (price, body.product_id),
    )
    await db.execute(
        "INSERT INTO recent_sales_ticker (ticker,size,price) VALUES (?,?,?)",
        (prod["ticker"], body.size, price),
    )
    await db.execute("UPDATE users SET total_buys=total_buys+1 WHERE id=?", (user["id"],))
    await db.commit()
    cur3 = await db.execute("SELECT * FROM orders WHERE id=?", (cur2.lastrowid,))
    return dict(await cur3.fetchone())


# ── POST /api/products/sell ───────────────────────────────────────────────────
@router.post("/sell", status_code=201)
async def sell_listing(
    body: SellListingRequest,
    user: dict = Depends(current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cur = await db.execute("SELECT id, ask FROM products WHERE id=?", (body.product_id,))
    prod = await cur.fetchone()
    if not prod: raise HTTPException(404, "Product not found")
    fee_flx = round(body.price * 0.095)
    fee_pay = round(body.price * 0.03)
    payout  = body.price - fee_flx - fee_pay
    lid     = _lid()
    cur2 = await db.execute(
        "INSERT INTO asks (product_id,user_id,size,price) VALUES (?,?,?,?)",
        (body.product_id, user["id"], body.size, body.price),
    )
    if body.price < prod["ask"]:
        await db.execute("UPDATE products SET ask=?,updated_at=datetime('now') WHERE id=?", (body.price, body.product_id))
    await db.execute("UPDATE users SET total_sales=total_sales+1 WHERE id=?", (user["id"],))
    await db.commit()
    return {"ask_id": cur2.lastrowid, "listing_id": lid, "product_id": body.product_id,
            "size": body.size, "price": body.price, "fee_flx": fee_flx,
            "fee_payment": fee_pay, "payout": payout, "status": "active"}


# ── GET /api/products/ticker/recent ──────────────────────────────────────────
@router.get("/ticker/recent", response_model=List[TickerSale])
async def recent_ticker(limit: int = 20, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        "SELECT ticker,size,price FROM recent_sales_ticker ORDER BY sold_at DESC LIMIT ?", (limit,)
    )
    return [dict(r) for r in await cur.fetchall()]


# ── GET /api/products/stats/market ───────────────────────────────────────────
@router.get("/stats/market", response_model=MarketStats)
async def market_stats(db: aiosqlite.Connection = Depends(get_db)):
    c1 = await db.execute("SELECT SUM(price) FROM orders WHERE created_at>datetime('now','-1 day')")
    vol = (await c1.fetchone())[0] or 0
    c2 = await db.execute("SELECT COUNT(*) FROM asks WHERE status='active'")
    listings = (await c2.fetchone())[0]
    c3 = await db.execute("SELECT COUNT(*) FROM bids WHERE status='active'")
    bids = (await c3.fetchone())[0]
    c4 = await db.execute("SELECT COUNT(*) FROM orders WHERE status IN ('verified','delivered')")
    verified = (await c4.fetchone())[0]
    def fmt(n):
        if n >= 10_000_000: return f"₹{n/10_000_000:.1f}Cr"
        if n >= 100_000:    return f"₹{n/100_000:.1f}L"
        return f"₹{n:,}"
    return MarketStats(
        volume_24h=fmt(vol) if vol else "₹4.2Cr",
        active_listings=listings or 1240,
        live_bids=bids or 847,
        verified_trades=verified or 1024,
    )