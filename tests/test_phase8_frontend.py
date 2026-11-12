"""Automated verification test suite for Phase 8: React Web Frontend."""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from src.api.app import app
from src.database.seed import init_db


def test_phase8_frontend_integration():
    print("\n" + "=" * 75, flush=True)
    print(" VERIFYING PHASE 8: REACT WEB FRONTEND INTEGRATION", flush=True)
    print("=" * 75, flush=True)

    # 1. Check frontend build artifacts on disk
    print("\n[1/5] Verifying React build bundle on disk...", flush=True)
    frontend_dist = PROJECT_ROOT / "frontend" / "dist"
    index_html = frontend_dist / "index.html"
    assets_dir = frontend_dist / "assets"

    assert frontend_dist.exists(), "frontend/dist directory does not exist!"
    assert index_html.exists(), "frontend/dist/index.html is missing!"
    assert assets_dir.exists(), "frontend/dist/assets is missing!"

    js_files = list(assets_dir.glob("*.js"))
    css_files = list(assets_dir.glob("*.css"))
    assert len(js_files) > 0, "No compiled JS bundle found in dist/assets!"
    assert len(css_files) > 0, "No compiled CSS bundle found in dist/assets!"
    print(f"  [PASS] Dist bundle verified: {js_files[0].name} ({js_files[0].stat().st_size} bytes)", flush=True)
    print(f"  [PASS] Dist styles verified: {css_files[0].name} ({css_files[0].stat().st_size} bytes)", flush=True)

    # 2. Test FastAPI serving React SPA
    print("\n[2/5] Testing FastAPI root endpoint GET / serving React SPA...", flush=True)
    init_db()
    client = TestClient(app)

    r_root = client.get("/")
    assert r_root.status_code == 200, f"Expected 200, got {r_root.status_code}"
    assert "TechNova Enterprise AI" in r_root.text
    assert "<div id=\"root\"></div>" in r_root.text
    print("  [PASS] GET / successfully delivers React Single-Page Application HTML!", flush=True)

    # 3. Test serving compiled JavaScript bundle via static route
    print("\n[3/5] Testing Static Asset route GET /assets/<bundle>.js...", flush=True)
    bundle_name = js_files[0].name
    r_asset = client.get(f"/assets/{bundle_name}")
    assert r_asset.status_code == 200, f"Expected 200, got {r_asset.status_code}"
    assert len(r_asset.content) > 1000
    print(f"  [PASS] GET /assets/{bundle_name} served cleanly ({len(r_asset.content)} bytes)!", flush=True)

    # 4. Test Persona Login for Frontend Auth
    print("\n[4/5] Testing Persona authentication for Frontend AuthContext...", flush=True)
    r_login = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "password123"},
    )
    assert r_login.status_code == 200
    data = r_login.json()
    assert "access_token" in data
    assert data["user"]["username"] == "alice"
    assert data["user"]["role"] == "employee"
    print(f"  [PASS] Persona 'alice' authenticated! Bearer token length: {len(data['access_token'])}", flush=True)

    # 5. Test Frontend API Document Catalog Endpoint
    print("\n[5/5] Testing Document Catalog retrieval for DocumentManager component...", flush=True)
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    r_docs = client.get("/api/v1/documents", headers=headers)
    assert r_docs.status_code == 200
    docs = r_docs.json()
    assert isinstance(docs, list)
    print(f"  [PASS] Document catalog retrieved: {len(docs)} registered enterprise documents!", flush=True)

    print("\n" + "=" * 75, flush=True)
    print(" ALL 5 PHASE 8 REACT FRONTEND INTEGRATION TESTS PASSED!", flush=True)
    print("=" * 75 + "\n", flush=True)


if __name__ == "__main__":
    test_phase8_frontend_integration()
