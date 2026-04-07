import httpx, time

for i in range(24):
    try:
        r = httpx.get("https://auction-api-5lfe.onrender.com/api/auctions", follow_redirects=True, timeout=15)
        ct = r.headers.get("content-type", "?")
        print(f"Attempt {i+1}: {r.status_code} ct={ct}")
        print(r.text[:500])
        if "application/json" in ct:
            break
    except Exception as e:
        print(f"Attempt {i+1}: {e}")
    time.sleep(15)
