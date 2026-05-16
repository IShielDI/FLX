"""main.py — FLX v2 Backend"""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from models.database import init_db
from routers import auth, products, community, users
from routers import websocket as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("✅  FLX v2 database ready")
    yield


app = FastAPI(title="FLX Marketplace API v2", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

images_dir = Path(__file__).parent / "images"
images_dir.mkdir(exist_ok=True)
app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")

app.include_router(auth.router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(users.router,     prefix="/api/users",     tags=["Users"])
app.include_router(products.router,  prefix="/api/products",  tags=["Products"])
app.include_router(community.router, prefix="/api/community", tags=["Community"])
app.include_router(ws_router.router,                          tags=["WebSocket"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}