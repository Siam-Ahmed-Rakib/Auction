"""Download auction images from Unsplash and upload to Supabase Storage, then update DB."""
import os
import re
import urllib.request
import json

SUPABASE_URL = "https://lmthclkskkechzyfenuf.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdGhjbGtza2tlY2h6eWZlbnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTg3MTUsImV4cCI6MjA5MTEzNDcxNX0.E7w5k3rgn31o8GmuuSUFvwJrLmIAjs-VL-UFv0NvsmE"
BUCKET = "auction-images"

# All auctions with their current Unsplash URLs
AUCTIONS = [
    {"id": "4c2abb63-7e5f-4216-8790-188642c881cd", "url": "https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=600&h=400&fit=crop"},
    {"id": "44ce2d5e-e853-4471-a4ed-47a5c4a5b9b7", "url": "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600&h=400&fit=crop"},
    {"id": "c141c0af-a5c5-4542-a02b-5591bb132e1c", "url": "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=400&fit=crop"},
    {"id": "f1b80828-7f4b-4448-8fed-ecd6f18cdac5", "url": "https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=600&h=400&fit=crop"},
    {"id": "dd002929-dcdb-4283-ae6d-a070f2dbd3d1", "url": "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&h=400&fit=crop"},
    {"id": "cb1fa93d-3954-405a-9c95-162f29018f2b", "url": "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=600&h=400&fit=crop"},
    {"id": "9aeec356-408e-4eb2-aed6-6dab77ef2c94", "url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=400&fit=crop"},
    {"id": "c30d4273-e1b0-434b-9e28-7247140265b0", "url": "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=600&h=400&fit=crop"},
    {"id": "3b31ab96-07e2-4bfb-be8a-89c1c1850d67", "url": "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=600&h=400&fit=crop"},
    {"id": "4cc0a03c-3395-4bb8-b22b-c271be2152b4", "url": "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&h=400&fit=crop"},
    {"id": "0d3ec1ab-6a1b-4eb1-b2b3-ce4ce2d33d6a", "url": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=400&fit=crop"},
    {"id": "2d10a9fc-c438-499e-8a65-49704c3fbb2f", "url": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop"},
    {"id": "d80cb358-a56a-4cf3-8c58-ec4b82c6bf75", "url": "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&h=400&fit=crop"},
    {"id": "56314234-dfe8-4edd-af46-5265e8ecfd05", "url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop"},
    {"id": "8b37249a-d964-4d93-83d4-101850e67367", "url": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=400&fit=crop"},
    {"id": "f117f38a-bd1b-4d4c-a2da-d173576dcef1", "url": "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=600&h=400&fit=crop"},
    {"id": "c86a34f3-b9b4-4633-b894-493482c18407", "url": "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600&h=400&fit=crop"},
]


def download_image(url):
    """Download image bytes from URL."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read(), resp.headers.get("Content-Type", "image/jpeg")


def upload_to_supabase(file_bytes, file_path, content_type):
    """Upload image to Supabase Storage bucket."""
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{file_path}"
    req = urllib.request.Request(
        upload_url,
        data=file_bytes,
        method="POST",
        headers={
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def get_public_url(file_path):
    """Get the public URL for an uploaded file."""
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{file_path}"


def main():
    results = {}
    for i, auction in enumerate(AUCTIONS):
        auction_id = auction["id"]
        url = auction["url"]
        # Extract photo ID from Unsplash URL
        match = re.search(r"photo-([a-zA-Z0-9_-]+)", url)
        photo_id = match.group(1) if match else f"img_{i}"
        file_path = f"seed/{auction_id}/{photo_id}.jpg"

        print(f"[{i+1}/{len(AUCTIONS)}] Downloading {photo_id}...")
        try:
            img_bytes, content_type = download_image(url)
            print(f"  Downloaded {len(img_bytes)} bytes")

            print(f"  Uploading to {file_path}...")
            upload_to_supabase(img_bytes, file_path, content_type or "image/jpeg")

            public_url = get_public_url(file_path)
            results[auction_id] = public_url
            print(f"  OK: {public_url}")
        except Exception as e:
            print(f"  FAILED: {e}")
            results[auction_id] = None

    # Print SQL to update the database
    print("\n\n--- SQL UPDATE STATEMENTS ---\n")
    for auction_id, new_url in results.items():
        if new_url:
            escaped = new_url.replace("'", "''")
            print(f"UPDATE \"Auction\" SET images = ARRAY['{escaped}'] WHERE id = '{auction_id}';")

    print(f"\nDone! {sum(1 for v in results.values() if v)}/{len(results)} images migrated.")


if __name__ == "__main__":
    main()
