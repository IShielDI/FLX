"""
models/database.py  —  FLX v2
Extended schema: SKU, release_date, colorway, condition, description, sku.
30 products seeded across all categories with real Unsplash image URLs
stored in the DB (not hardcoded in the frontend).
"""
 
import aiosqlite
from pathlib import Path
 
DB_PATH = Path(__file__).parent.parent / "flx.db"
 
 
async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db
 
 
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript("""
            PRAGMA journal_mode=WAL;
 
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    UNIQUE NOT NULL,
                email         TEXT    UNIQUE NOT NULL,
                password_hash TEXT    NOT NULL,
                avatar        TEXT    DEFAULT 'UN',
                location      TEXT    DEFAULT '',
                bio           TEXT    DEFAULT '',
                rep_score     INTEGER DEFAULT 0,
                is_verified   INTEGER DEFAULT 0,
                total_sales   INTEGER DEFAULT 0,
                total_buys    INTEGER DEFAULT 0,
                created_at    TEXT    DEFAULT (datetime('now'))
            );
 
            CREATE TABLE IF NOT EXISTS products (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                slug          TEXT    UNIQUE NOT NULL,
                ticker        TEXT    NOT NULL,
                name          TEXT    NOT NULL,
                brand         TEXT    NOT NULL,
                category      TEXT    NOT NULL,
                sku           TEXT    DEFAULT '',
                colorway      TEXT    DEFAULT '',
                release_date  TEXT    DEFAULT '',
                condition     TEXT    DEFAULT 'New',
                description   TEXT    DEFAULT '',
                base_price    INTEGER NOT NULL,
                current_price INTEGER NOT NULL,
                last_sold     INTEGER NOT NULL,
                bid           INTEGER NOT NULL,
                ask           INTEGER NOT NULL,
                change_24h    REAL    DEFAULT 0,
                volume        INTEGER DEFAULT 0,
                image_url     TEXT    DEFAULT '',
                sizes         TEXT    DEFAULT '[]',
                is_verified   INTEGER DEFAULT 0,
                is_trending   INTEGER DEFAULT 0,
                updated_at    TEXT    DEFAULT (datetime('now'))
            );
 
            CREATE TABLE IF NOT EXISTS price_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id  INTEGER NOT NULL REFERENCES products(id),
                price       INTEGER NOT NULL,
                recorded_at TEXT    DEFAULT (datetime('now'))
            );
 
            CREATE TABLE IF NOT EXISTS bids (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id),
                user_id    INTEGER NOT NULL REFERENCES users(id),
                size       TEXT    NOT NULL,
                amount     INTEGER NOT NULL,
                status     TEXT    DEFAULT 'active',
                created_at TEXT    DEFAULT (datetime('now'))
            );
 
            CREATE TABLE IF NOT EXISTS asks (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id),
                user_id    INTEGER NOT NULL REFERENCES users(id),
                size       TEXT    NOT NULL,
                price      INTEGER NOT NULL,
                status     TEXT    DEFAULT 'active',
                created_at TEXT    DEFAULT (datetime('now'))
            );
 
            CREATE TABLE IF NOT EXISTS orders (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                buyer_id    INTEGER NOT NULL REFERENCES users(id),
                seller_id   INTEGER REFERENCES users(id),
                product_id  INTEGER NOT NULL REFERENCES products(id),
                size        TEXT    NOT NULL,
                price       INTEGER NOT NULL,
                fee_flx     INTEGER NOT NULL,
                fee_payment INTEGER NOT NULL,
                payout      INTEGER NOT NULL,
                status      TEXT    DEFAULT 'pending',
                listing_id  TEXT    NOT NULL,
                created_at  TEXT    DEFAULT (datetime('now'))
            );
 
            CREATE TABLE IF NOT EXISTS wishlist (
                user_id    INTEGER NOT NULL REFERENCES users(id),
                product_id INTEGER NOT NULL REFERENCES products(id),
                added_at   TEXT    DEFAULT (datetime('now')),
                PRIMARY KEY (user_id, product_id)
            );
 
            CREATE TABLE IF NOT EXISTS community_posts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                board      TEXT    NOT NULL,
                type       TEXT    NOT NULL,
                title      TEXT    NOT NULL,
                body       TEXT    DEFAULT '',
                upvotes    INTEGER DEFAULT 0,
                downvotes  INTEGER DEFAULT 0,
                is_hot     INTEGER DEFAULT 0,
                created_at TEXT    DEFAULT (datetime('now'))
            );
 
            CREATE TABLE IF NOT EXISTS post_comments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id    INTEGER NOT NULL REFERENCES community_posts(id),
                user_id    INTEGER NOT NULL REFERENCES users(id),
                body       TEXT    NOT NULL,
                created_at TEXT    DEFAULT (datetime('now'))
            );
 
            CREATE TABLE IF NOT EXISTS recent_sales_ticker (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker  TEXT    NOT NULL,
                size    TEXT    NOT NULL,
                price   INTEGER NOT NULL,
                sold_at TEXT    DEFAULT (datetime('now'))
            );
        """)
        await db.commit()
 
        cur = await db.execute("SELECT COUNT(*) FROM products")
        if (await cur.fetchone())[0] == 0:
            await _seed(db)
 
 
async def _seed(db: aiosqlite.Connection):
    import hashlib, random
 
    def _h(pw): return hashlib.sha256(pw.encode()).hexdigest()
 
    # ── Users ──────────────────────────────────────────────────────────────────
    await db.executemany(
        "INSERT INTO users (username,email,password_hash,avatar,rep_score,is_verified,location,bio,total_sales,total_buys) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            ("soleking_96",    "sole@flx.in",  _h("sole1234"), "SK", 1240, 1, "Mumbai, India",     "Sneaker collector. Jordan head. 11 years in the game.", 23, 47),
            ("streetcurator",  "sc@flx.in",    _h("sc1234"),   "SC", 3210, 1, "Delhi, India",      "Streetwear curator. Supreme, Off-White, Stussy.",       61, 29),
            ("watchdogg",      "wd@flx.in",    _h("wd1234"),   "WD",  890, 1, "Bengaluru, India",  "Horology nerd. AP, Rolex, Patek collector.",            8,  12),
            ("fraghead_mx",    "fm@flx.in",    _h("fm1234"),   "FM",  445, 0, "Mumbai, India",     "Fragrance aficionado. Creed, Amouage, MFK.",             5,  19),
            ("kaws_collector", "kc@flx.in",    _h("kc1234"),   "KC", 2100, 1, "Hyderabad, India",  "Art toy collector. KAWS, Bearbrick, MSCHF.",            14, 33),
            ("drip_oracle",    "do@flx.in",    _h("do1234"),   "DO",  780, 0, "Chennai, India",    "Trend forecaster. If I cop it, it's fire.",             17, 22),
        ],
    )
 
    # ── Products (30 items, image_url stored in DB) ────────────────────────────
    # columns: slug, ticker, name, brand, category, sku, colorway, release_date,
    #          condition, description, base_price, current_price, last_sold,
    #          bid, ask, change_24h, volume, image_url, sizes, is_verified, is_trending
    products = [
        # ── Sneakers ──────────────────────────────────────────────────────────
        ("aj1-bred",         "AJ1-BRED",    "Air Jordan 1 Retro High OG 'Bred'",          "Jordan Brand",        "Sneakers",
         "555088-061", "Black/Red/White",   "2016-09-03", "New",
         "The OG colorway that started it all. Black tumbled leather upper with red accents and Nike Air branding. The most iconic sneaker ever released.",
         18500, 19200, 18900, 18200, 19200,  3.76, 47,
         "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=90",
         '["US 7","US 8","US 9","US 10","US 11","US 12"]', 1, 1),
 
        ("ts-olive-4",       "TS-OLIVE",    "Travis Scott x Air Jordan 4 'Olive'",         "Nike / Travis Scott", "Sneakers",
         "DZ4731-200","Neutral Olive/Sail", "2023-10-05", "New",
         "Travis Scott's most anticipated Jordan 4 collaboration. Olive suede with reverse Swoosh and hidden pocket detail on the heel.",
         32000, 34500, 33200, 33800, 34500,  6.21, 23,
         "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&q=90",
         '["US 8","US 9","US 10","US 11"]', 1, 1),
 
        ("nb-990v6-grey",    "NB-990V6",    "New Balance 990v6 'Grey'",                    "New Balance",         "Sneakers",
         "M990GL6",   "Grey/White",         "2023-06-01", "New",
         "Made in USA. The pinnacle of New Balance engineering. Premium suede and mesh upper with ENCAP midsole technology.",
         11000, 10500, 10800, 10200, 10500, -2.33, 38,
         "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=90",
         '["US 7","US 8","US 9","US 10","US 11","US 12","US 13"]', 1, 0),
 
        ("yzy-foam-runner",  "YZY-FOAM",    "Adidas Yeezy Foam Runner 'Stone Sage'",       "Adidas Yeezy",        "Sneakers",
         "GX4472",    "Stone Sage",         "2022-03-19", "New",
         "Kanye's most divisive silhouette. Made from algae-derived foam. Lightweight, sustainable, and impossibly comfortable.",
         7800, 8400, 8100, 8200, 8400,  4.55, 55,
         "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&q=90",
         '["US 4","US 5","US 6","US 7","US 8","US 9","US 10","US 11","US 12"]', 1, 1),
 
        ("patta-am1-waves",  "PATTA-AM1",   "Patta x Nike Air Max 1 'Waves'",              "Nike x Patta",        "Sneakers",
         "DH1348-001","Black/Night Maroon", "2021-11-01", "New",
         "Amsterdam meets Beaverton. Patta's most successful collaboration. Premium leather with wave motif embroidery.",
         22000, 24500, 23500, 24000, 24500,  5.12, 29,
         "https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=800&q=90",
         '["US 7","US 8","US 9","US 10","US 11","US 12"]', 1, 0),
 
        ("dunk-low-pandas",  "DUNK-PANDA",  "Nike Dunk Low 'Panda'",                       "Nike",                "Sneakers",
         "DD1391-100","White/Black",        "2021-03-10", "New",
         "The sneaker that defined a generation. Clean white leather with black overlays. Impossible to go wrong.",
         8500, 9200, 8900, 8800, 9200,  2.14, 89,
         "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=90",
         '["US 5","US 6","US 7","US 8","US 9","US 10","US 11","US 12"]', 1, 1),
 
        ("jordan-3-white-cement","AJ3-WC",  "Air Jordan 3 Retro 'White Cement'",           "Jordan Brand",        "Sneakers",
         "854262-101","White/Cement Grey",  "2018-02-17", "New",
         "Michael's favourite. Elephant print overlays, visible Air unit, and Jumpman on the tongue. A true classic.",
         16500, 17800, 17200, 17000, 17800,  1.88, 34,
         "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=90",
         '["US 7","US 8","US 9","US 10","US 11","US 12"]', 1, 0),
 
        ("asics-gel-lyte-iii","ASICS-GL3",  "Asics Gel Lyte III OG 'Birch'",              "Asics",               "Sneakers",
         "1191A304-200","Birch/Tan",        "2023-04-01", "New",
         "Japanese running heritage reborn. Split tongue, premium suede, and GEL cushioning. A cult favourite.",
         9500, 10200, 9800, 9600, 10200,  3.21, 18,
         "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=90",
         '["US 7","US 8","US 9","US 10","US 11"]', 0, 0),
 
        ("aj11-bred",        "AJ11-BRED",   "Air Jordan 11 Retro 'Bred'",                  "Jordan Brand",        "Sneakers",
         "378037-061","Black/Varsity Red",  "2019-12-14", "New",
         "The shoe that made patent leather cool. Worn by MJ in the 1996 NBA Finals. The most hyped retro of every decade.",
         21000, 22500, 21800, 21500, 22500,  4.09, 61,
         "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=90",
         '["US 7","US 8","US 9","US 10","US 11","US 12"]', 1, 1),
 
        # ── Streetwear ────────────────────────────────────────────────────────
        ("sup-bogo-fw23",    "SUP-BOGO",    "Supreme Box Logo Hoodie FW23",                "Supreme",             "Streetwear",
         "SUP-FW23-BLK","Black",           "2023-09-07", "New",
         "The most coveted logo in streetwear. 500g heavyweight fleece. Box logo screen printed on chest. Drops every season, never enough.",
         8500, 9100, 8800, 8700, 9100,  1.82, 61,
         "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=90",
         '["S","M","L","XL","XXL"]', 0, 0),
 
        ("stussy-8-ball",    "STU-8BALL",   "Stüssy 8 Ball Fleece Jacket",                 "Stüssy",              "Streetwear",
         "118449",    "Black",              "2023-11-01", "New",
         "Stussy's cult-classic 8 ball graphic on a heavyweight fleece zip jacket. Old-money streetwear energy.",
         6500, 7200, 6900, 6800, 7200,  2.90, 33,
         "https://images.unsplash.com/photo-1578681041175-9717c638e2b3?w=800&q=90",
         '["S","M","L","XL"]', 0, 0),
 
        ("carhartt-detroit",  "CARR-DET",   "Carhartt WIP Detroit Jacket",                 "Carhartt WIP",        "Streetwear",
         "I027857",   "Hamilton Brown",     "2023-08-01", "New",
         "The ultimate workwear crossover. Heavy-duty denim construction with quilted lining. A wardrobe staple for a decade.",
         7200, 7800, 7500, 7400, 7800,  1.20, 27,
         "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=90",
         '["S","M","L","XL","XXL"]', 0, 0),
 
        ("palace-tri-ferg",   "PAL-TRIFERG","Palace Tri-Ferg Hoodie",                      "Palace",              "Streetwear",
         "PAL-AW23-001","Navy",            "2023-10-20", "New",
         "Skate-royalty from London. The tri-ferg logo has become as recognizable as any luxury house monogram.",
         9800, 10500, 10100, 10000, 10500,  3.45, 19,
         "https://images.unsplash.com/photo-1578681041175-9717c638e2b3?w=800&q=90",
         '["S","M","L","XL"]', 0, 1),
 
        ("ow-industrial-belt","OW-IBELT",   "Off-White Industrial Belt",                   "Off-White",           "Accessories",
         "OMRB035F21FAB001","Yellow/Black","2021-01-01", "New",
         "Virgil's most copied accessory. Industrial webbing with signature yellow and black stripe. The OG hype accessory.",
         4500, 5100, 4900, 5000, 5100,  8.33, 12,
         "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=90",
         '["One Size"]', 0, 0),
 
        # ── Watches ───────────────────────────────────────────────────────────
        ("ap-royal-oak",     "AP-ROYAL",    "Audemars Piguet Royal Oak 15500ST",           "Audemars Piguet",     "Watches",
         "15500ST.OO.1220ST.01","Blue",    "2019-04-01", "New",
         "The watch that invented luxury sports. Gerald Genta's masterpiece. Integrated bracelet, tapisserie dial, and 4302 movement.",
         4200000, 4650000, 4500000, 4600000, 4650000,  2.11,  3,
         "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=90",
         '["One Size"]', 1, 1),
 
        ("rolex-daytona",    "RLX-DAY",     "Rolex Cosmograph Daytona 116500LN",           "Rolex",               "Watches",
         "116500LN",  "White Dial",         "2016-03-01", "New",
         "The holy grail of sports watches. Ceramic bezel, Calibre 4130 movement, 72-hour power reserve. 10-year waitlist at ADs.",
         3200000, 3580000, 3450000, 3550000, 3580000,  1.88,  5,
         "https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800&q=90",
         '["One Size"]', 1, 1),
 
        ("pp-nautilus",      "PP-NAUT",     "Patek Philippe Nautilus 5711/1A",             "Patek Philippe",      "Watches",
         "5711/1A-010","Olive Dial",       "2021-04-13", "New",
         "The last Nautilus with steel bracelet. Discontinued in 2021. Now worth 3x retail. The most coveted watch in the world.",
         8500000, 9200000, 8900000, 9100000, 9200000,  4.22,  1,
         "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=90",
         '["One Size"]', 1, 1),
 
        ("tudor-black-bay",  "TUDOR-BB58",  "Tudor Black Bay 58 Navy Blue",                "Tudor",               "Watches",
         "M79030B-0001","Navy Blue",       "2021-07-01", "New",
         "The affordable sports watch with no compromises. MT5402 in-house movement, 200m water resistance. The enthusiast's choice.",
         185000, 198000, 192000, 190000, 198000,  1.55,  8,
         "https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800&q=90",
         '["One Size"]', 1, 0),
 
        # ── Fragrances ────────────────────────────────────────────────────────
        ("creed-aventus",    "CR-AVENTUS",  "Creed Aventus EDP 100ml",                     "Creed",               "Fragrances",
         "CR-AV-100",  "—",               "2010-09-01", "New",
         "The king of masculine fragrances. Pineapple, birch, and musk. Batch variation makes each bottle unique. The most discussed fragrance online.",
         28000, 26500, 27000, 26000, 26500, -1.45, 19,
         "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=90",
         '["100ml","250ml"]', 0, 0),
 
        ("mfk-baccarat",     "MFK-BR540",   "Maison Francis Kurkdjian Baccarat Rouge 540", "MFK",                 "Fragrances",
         "MFK-BR540-70","—",              "2015-01-01", "New",
         "The most Instagrammed fragrance of the decade. Jasmine, saffron, ambergris. Both adored and satirized. Always sold out.",
         22000, 24000, 23200, 23500, 24000,  3.10, 31,
         "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=90",
         '["70ml","200ml"]', 1, 1),
 
        ("tf-oud-wood",      "TF-OUD",      "Tom Ford Oud Wood EDP 100ml",                 "Tom Ford",            "Fragrances",
         "TF-OW-100",  "—",               "2007-01-01", "New",
         "The fragrance that made oud mainstream. Rare oud wood, sandalwood, cardamom. Worn by every CEO in the room.",
         14500, 15800, 15200, 15000, 15800,  2.20, 14,
         "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=90",
         '["100ml","250ml"]', 0, 0),
 
        # ── Collectibles ──────────────────────────────────────────────────────
        ("bb-kaws-1000",     "BB-KAWS",     "KAWS BFF Bearbrick 1000%",                    "KAWS x Medicom",      "Collectibles",
         "KAWS-BFF-1000","Pink",           "2020-09-01", "New",
         "KAWS's most iconic companion in Bearbrick form. 70cm tall. Limited worldwide release. The centrepiece of any serious art toy collection.",
         95000, 112000, 108000, 110000, 112000, 12.50,  7,
         "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=90",
         '["1000%"]', 1, 1),
 
        ("mschf-big-red",    "MSCHF-BR",    "MSCHF Big Red Boots",                         "MSCHF",               "Collectibles",
         "MSCHF-BRB",  "Red",             "2023-02-01", "New",
         "The internet's most viral shoe. Cartoon-inspired design. More art piece than footwear. Every creative director owns a pair.",
         38000, 45000, 42000, 44000, 45000, 15.22,  4,
         "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=90",
         '["US 5","US 6","US 7","US 8","US 9","US 10","US 11"]', 0, 1),
 
        ("bb-400-basquiat",  "BB-BASQ",     "Medicom Bearbrick Basquiat #4 400%",          "Medicom x Basquiat",  "Collectibles",
         "BB-BASQ4-400","—",              "2022-11-01", "New",
         "Jean-Michel Basquiat's art licensed onto the iconic Bearbrick form. 28cm. Museum-quality collectible.",
         28000, 32000, 30500, 31000, 32000,  8.10,  6,
         "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=90",
         '["400%"]', 0, 0),
 
        # ── More Sneakers ─────────────────────────────────────────────────────
        ("aj4-sb-pine",      "AJ4-SB",      "Nike SB x Air Jordan 4 'Pine Green'",         "Nike SB x Jordan",    "Sneakers",
         "DR5415-103", "White/Pine Green", "2023-09-09", "New",
         "The most unexpected collab of 2023. Skate-ready construction meets Jordan 4 heritage. Sold out in 11 seconds globally.",
         28000, 31000, 29500, 30000, 31000,  7.88, 15,
         "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=90",
         '["US 7","US 8","US 9","US 10","US 11","US 12"]', 1, 1),
 
        ("samba-classic",    "ADI-SAMBA",   "Adidas Samba OG 'White/Black'",               "Adidas",              "Sneakers",
         "B75806",    "White/Black/Gum",   "2023-01-01", "New",
         "The terrace shoe that became the fashion shoe. Worn by footballers in the 70s, by everyone in 2023. Timeless.",
         8200, 9500, 9100, 9200, 9500,  6.30, 92,
         "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=90",
         '["US 5","US 6","US 7","US 8","US 9","US 10","US 11","US 12"]', 0, 1),
 
        ("nmd-r1-pharrell",  "NMD-PHARR",   "Pharrell x Adidas NMD Human Race",            "Adidas x Pharrell",   "Sneakers",
         "GY0089",    "Tan",               "2022-09-01", "New",
         "Pharrell's Human Race lettering across the toe. The NMD silhouette elevated to art object status.",
         12000, 13500, 12900, 13000, 13500,  4.55, 22,
         "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=90",
         '["US 7","US 8","US 9","US 10","US 11","US 12"]', 0, 0),
 
        # ── Accessories ───────────────────────────────────────────────────────
        ("lv-keepall-55",    "LV-KEEP55",   "Louis Vuitton Keepall Bandouliere 55",        "Louis Vuitton",       "Accessories",
         "M41414",    "Monogram Canvas",    "2020-01-01", "New",
         "The original travel bag. Iconic monogram canvas. Gold-tone hardware. The bag every sneakerhead wants to carry their heat in.",
         195000, 210000, 205000, 208000, 210000,  1.44,  4,
         "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=90",
         '["One Size"]', 1, 0),
 
        ("gucci-cap-gg",     "GCC-GGCAP",   "Gucci GG Canvas Baseball Cap",                "Gucci",               "Accessories",
         "576258",    "Beige/Ebony",        "2022-06-01", "New",
         "The GG monogram cap that became the default luxury streetwear headwear. Adjustable strap, structured brim.",
         38000, 41000, 39500, 40000, 41000,  2.66,  9,
         "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=90",
         '["One Size"]', 1, 0),
 
        ("hermes-h-belt",    "HER-HBELT",   "Hermès H Belt Buckle 32mm with Strap",        "Hermès",              "Accessories",
         "060048CK37","Gold/Black",         "2021-01-01", "New",
         "The most recognizable belt buckle in the world. Palladium-plated hardware. Box calf leather. The belt that separates collectors from tourists.",
         68000, 74000, 71000, 72000, 74000,  3.10,  6,
         "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=90",
         '["70cm","75cm","80cm","85cm","90cm"]', 1, 0),
    ]
 
    # Insert products
    for p in products:
        (slug,ticker,name,brand,category,sku,colorway,release_date,condition,
         description,base_price,current_price,last_sold,bid,ask,change_24h,
         volume,image_url,sizes,is_verified,is_trending) = p
        await db.execute(
            """INSERT INTO products
               (slug,ticker,name,brand,category,sku,colorway,release_date,condition,
                description,base_price,current_price,last_sold,bid,ask,change_24h,
                volume,image_url,sizes,is_verified,is_trending)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (slug,ticker,name,brand,category,sku,colorway,release_date,condition,
             description,base_price,current_price,last_sold,bid,ask,change_24h,
             volume,image_url,sizes,is_verified,is_trending),
        )
 
    await db.commit()
 
    # ── Price history (90 days per product) ────────────────────────────────────
    cur = await db.execute("SELECT id, base_price FROM products")
    all_products = await cur.fetchall()
    for row in all_products:
        pid, base = row["id"], row["base_price"]
        price = base * (0.85 + random.random() * 0.1)
        for day in range(90, -1, -1):
            noise = (random.random() - 0.5) * 0.03
            reversion = (base - price) * 0.03
            price = price * (1 + noise + reversion / base)
            await db.execute(
                f"INSERT INTO price_history (product_id,price,recorded_at) VALUES (?,?,datetime('now','-{day} days'))",
                (pid, int(price)),
            )
 
    # ── Seed bids and asks (realistic order book) ──────────────────────────────
    cur2 = await db.execute("SELECT id, ask, bid, sizes FROM products LIMIT 15")
    top_products = await cur2.fetchall()
    import json as _json
    for row in top_products:
        sizes = _json.loads(row["sizes"])
        for uid in range(1, 4):
            # bids slightly below best bid
            for size in sizes[:3]:
                bid_amt = int(row["bid"] * random.uniform(0.88, 0.99))
                await db.execute(
                    "INSERT INTO bids (product_id,user_id,size,amount) VALUES (?,?,?,?)",
                    (row["id"], uid, size, bid_amt),
                )
            # asks slightly above best ask
            for size in sizes[:3]:
                ask_price = int(row["ask"] * random.uniform(1.01, 1.12))
                await db.execute(
                    "INSERT INTO asks (product_id,user_id,size,price) VALUES (?,?,?,?)",
                    (row["id"], ((uid % 6) + 1), size, ask_price),
                )
 
    # ── Recent sales ticker ─────────────────────────────────────────────────────
    ticker_rows = [
        ("AJ1-BRED",   "US 10",    19200),
        ("TS-OLIVE",   "US 9",     34500),
        ("YZY-FOAM",   "US 11",     8400),
        ("BB-KAWS",    "1000%",   112000),
        ("PATTA-AM1",  "US 8",     24500),
        ("RLX-DAY",    "One Size",3580000),
        ("SUP-BOGO",   "L",         9100),
        ("OW-IBELT",   "One Size",  5100),
        ("NB-990V6",   "US 9",     10500),
        ("AP-ROYAL",   "One Size",4650000),
        ("CR-AVENTUS", "100ml",    26500),
        ("STU-8BALL",  "M",         7200),
        ("DUNK-PANDA", "US 10",     9200),
        ("AJ11-BRED",  "US 9",     22500),
        ("MFK-BR540",  "70ml",     24000),
        ("AJ4-SB",     "US 10",    31000),
        ("ADI-SAMBA",  "US 10",     9500),
        ("MSCHF-BR",   "US 9",     45000),
        ("PP-NAUT",    "One Size",9200000),
        ("TF-OUD",     "100ml",    15800),
    ]
    await db.executemany(
        "INSERT INTO recent_sales_ticker (ticker,size,price) VALUES (?,?,?)",
        ticker_rows,
    )
 
    # ── Community posts ─────────────────────────────────────────────────────────
    posts = [
        (1, "Sneakers",          "Pickup",      "Just copped the Travis Scott Olive 4s for retail 🔥 AMA",                                        "Finally after 3 years of waiting. The quality is insane. The olive suede is butter soft.",                   847, 1),
        (2, "Market Discussion", "Discussion",  "Jordan 1 market cooling off — bear market incoming for OGs?",                                     "Volume down 40% since peak. Are we in a correction or full reversal? Share your takes.",                    612, 1),
        (3, "Watches",           "Flex",        "Royal Oak 15500 finally came in. Cannot believe I own this.",                                     "3 year waitlist. Worth every day. The tapisserie dial in person is something else entirely.",                1204, 1),
        (4, "Fragrances",        "Review",      "Creed Aventus batch comparison — 2014 vs 2019 vs 2023. Full breakdown.",                          "Tested 6 batches over 2 years. Here's what actually changed and what stayed the same.",                     388, 0),
        (5, "Collectibles",      "Legit Check", "Legit check on this KAWS BFF 1000% — seller claims 2022 Tokyo exclusive",                        "Tags look off to me. The finish on the face seems lighter than my other pieces. What do you all think?",    156, 0),
        (6, "Streetwear",        "Fit Check",   "Supreme BOGO with Acronym J1A-GT. Too loud or perfect harmony?",                                  "Both dropped same week. Felt like the universe was telling me something.",                                   921, 1),
        (1, "Sneakers",          "Discussion",  "Samba bubble about to burst? Or are we still early?",                                             "Every brand has a version now. Adidas can't keep up with demand. Is this a 2-year run or decade play?",      445, 1),
        (2, "Market Discussion", "Discussion",  "FLX vs StockX vs GOAT — which gives best seller payouts in India?",                              "Did a full comparison across 12 transactions. Results might surprise you.",                                  334, 0),
        (3, "Watches",           "Review",      "Tudor Black Bay 58 — 6 months of daily wear review",                                             "Replaced my Datejust with this. Here's why I don't regret it and what surprised me.",                       289, 0),
        (4, "Fragrances",        "Pickup",      "Finally got BR540 at retail from a Paris boutique. The grey market is cooked.",                   "Flew in, waited 40 mins, limit 1 per person. It was absolutely worth the trip.",                           512, 1),
    ]
    for user_id, board, ptype, title, body_text, upvotes, is_hot in posts:
        await db.execute(
            "INSERT INTO community_posts (user_id,board,type,title,body,upvotes,is_hot) VALUES (?,?,?,?,?,?,?)",
            (user_id, board, ptype, title, body_text, upvotes, is_hot),
        )
 
    await db.commit()
    print("✅  FLX v2 seed data inserted — 30 products, order books, community posts")
 