"""models/schemas.py — FLX v2 Pydantic schemas"""
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    avatar: str = ""
    is_verified: bool = False


class UserPublic(BaseModel):
    id: int
    username: str
    avatar: str
    rep_score: int
    is_verified: bool
    location: str
    bio: str
    total_sales: int
    total_buys: int
    created_at: str


class UserStats(BaseModel):
    total_purchases: int
    total_sales: int
    rep_score: int
    wishlist_count: int


class ProductOut(BaseModel):
    id: int
    slug: str
    ticker: str
    name: str
    brand: str
    category: str
    sku: str
    colorway: str
    release_date: str
    condition: str
    description: str
    basePrice: int
    currentPrice: int
    lastSold: int
    bid: int
    ask: int
    change24h: float
    volume: int
    image: str
    sizes: List[str]
    verified: bool
    trending: bool


class PriceTick(BaseModel):
    product_id: int
    ask: int
    bid: int
    lastSold: int
    change24h: float
    volume: int


class PriceHistoryPoint(BaseModel):
    day: int
    price: int


class OrderBookEntry(BaseModel):
    price: int
    size: str
    username: str
    is_verified: bool
    created_at: str


class OrderBook(BaseModel):
    asks: List[OrderBookEntry]
    bids: List[OrderBookEntry]
    spread: int
    recent_sales: List[dict]


class BidRequest(BaseModel):
    product_id: int
    size: str
    amount: int


class AskRequest(BaseModel):
    product_id: int
    size: str
    price: int


class BuyRequest(BaseModel):
    product_id: int
    size: str


class SellListingRequest(BaseModel):
    product_id: int
    size: str
    price: int


class OrderOut(BaseModel):
    id: int
    product_id: int
    size: str
    price: int
    fee_flx: int
    fee_payment: int
    payout: int
    status: str
    listing_id: str
    created_at: str


class PostOut(BaseModel):
    id: int
    user: str
    avatar: str
    rep: int
    is_verified: bool
    board: str
    type: str
    title: str
    body: str
    upvotes: int
    downvotes: int
    comments: int
    time: str
    hot: bool


class CreatePostRequest(BaseModel):
    board: str
    type: str
    title: str = Field(..., min_length=5, max_length=300)
    body: str = ""


class CommentOut(BaseModel):
    id: int
    user: str
    avatar: str
    is_verified: bool
    body: str
    created_at: str


class CreateCommentRequest(BaseModel):
    body: str = Field(..., min_length=1)


class TickerSale(BaseModel):
    ticker: str
    size: str
    price: int


class MarketStats(BaseModel):
    volume_24h: str
    active_listings: int
    live_bids: int
    verified_trades: int