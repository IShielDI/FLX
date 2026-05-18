"""routers/websocket.py — FLX v2: price ticks + orderbook broadcasts"""
import asyncio, json, random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from models.database import DB_PATH
import aiosqlite

router = APIRouter()

_clients: list[WebSocket] = []


async def _broadcast(data: str):
    dead = []
    for ws in _clients:
        try:    await ws.send_text(data)
        except: dead.append(ws)
    for ws in dead:
        if ws in _clients: _clients.remove(ws)


async def _tick_loop():
    """Every 5s: fluctuate prices and broadcast to all connected clients."""
    while True:
        await asyncio.sleep(5)
        if not _clients:
            continue
        try:
            async with aiosqlite.connect(DB_PATH) as db:
                db.row_factory = aiosqlite.Row
                cur = await db.execute("SELECT id,ask,bid,last_sold,change_24h,volume FROM products")
                rows = await cur.fetchall()
                updates = {}
                to_write = []
                for row in rows:
                    fluc    = random.uniform(-0.004, 0.004)
                    new_ask = max(1, int(row["ask"] * (1 + fluc)))
                    new_bid = int(new_ask * 0.975)
                    new_ch  = round(row["change_24h"] + random.uniform(-0.05, 0.05), 2)
                    updates[str(row["id"])] = {
                        "ask": new_ask, "bid": new_bid,
                        "lastSold": row["last_sold"],
                        "change24h": new_ch, "volume": row["volume"],
                    }
                    to_write.append((new_ask, new_bid, new_ch, row["id"]))
                await db.executemany(
                    "UPDATE products SET ask=?,bid=?,change_24h=?,updated_at=datetime('now') WHERE id=?",
                    to_write,
                )
                await db.commit()
            await _broadcast(json.dumps({"type": "price_tick", "data": updates}))
        except Exception as e:
            print(f"[WS tick error] {e}")


_loop_started = False


@router.websocket("/ws/live")
async def live_ws(ws: WebSocket):
    global _loop_started
    await ws.accept()
    _clients.append(ws)

    if not _loop_started:
        _loop_started = True
        asyncio.create_task(_tick_loop())

    # Send initial snapshot
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute("SELECT id,ask,bid,last_sold,change_24h,volume FROM products")
            rows = await cur.fetchall()
        snapshot = {str(r["id"]): {"ask": r["ask"], "bid": r["bid"], "lastSold": r["last_sold"],
                                    "change24h": r["change_24h"], "volume": r["volume"]}
                    for r in rows}
        await ws.send_text(json.dumps({"type": "snapshot", "data": snapshot}))
    except Exception as e:
        print(f"[WS snapshot error] {e}")

    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if ws in _clients: _clients.remove(ws)