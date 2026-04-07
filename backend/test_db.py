import asyncio
from app.config.database import engine
from sqlalchemy import text

async def test():
    async with engine.connect() as conn:
        r = await conn.execute(text('SELECT count(*) FROM "Auction"'))
        print("Auction count:", r.scalar())
        r2 = await conn.execute(text('SELECT id, title FROM "Auction" LIMIT 2'))
        for row in r2:
            print(row)

asyncio.run(test())
