"""Automated test suite verifying FastAPI REST API endpoints, JWT authentication, and RBAC."""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from src.api.app import app
from src.database.seed import init_db


def test_api_suite():
    print("\n" + "=" * 75, flush=True)
    print(" RUNNING TECHNOVA FASTAPI & AUTHENTICATION ENDPOINT TEST SUITE", flush=True)
    print("=" * 75, flush=True)

    # Initialize tables and seed users
    print("[*] Initializing database tables and seed users...", flush=True)
    init_db()
    print("[+] Database ready!", flush=True)

    client = TestClient(app)

    # -------------------------------------------------------------
    # 1. Health Check Endpoint
    # -------------------------------------------------------------
    print("\n[1/7] Testing GET /health...", flush=True)
    r_health = client.get("/health")
    assert r_health.status_code == 200, f"Expected 200, got {r_health.status_code}"
    assert r_health.json()["status"] == "healthy"
    print("  [PASS] /health is operational!", flush=True)

    # -------------------------------------------------------------
    # 2. Login with Valid Credentials (Alice - Engineering)
    # -------------------------------------------------------------
    print("\n[2/7] Testing POST /api/v1/auth/login (Alice - Engineering)...", flush=True)
    r_login = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "password123"},
    )
    assert r_login.status_code == 200, f"Login failed: {r_login.text}"
    alice_data = r_login.json()
    alice_token = alice_data["access_token"]
    assert alice_data["user"]["role"] == "employee"
    assert alice_data["user"]["department"] == "engineering"
    print(f"  [PASS] Logged in successfully! JWT Token issued: {alice_token[:25]}...", flush=True)

    # -------------------------------------------------------------
    # 3. Login with Invalid Password (Security & Audit Denials)
    # -------------------------------------------------------------
    print("\n[3/7] Testing POST /api/v1/auth/login (Invalid Password)...", flush=True)
    r_invalid = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "wrong_password!"},
    )
    assert r_invalid.status_code == 401
    print("  [PASS] Invalid password rejected with 401 Unauthorized.", flush=True)

    # -------------------------------------------------------------
    # 4. User Profile via Bearer Token (GET /api/v1/auth/me)
    # -------------------------------------------------------------
    print("\n[4/7] Testing GET /api/v1/auth/me (Protected Route)...", flush=True)
    headers_alice = {"Authorization": f"Bearer {alice_token}"}
    r_me = client.get("/api/v1/auth/me", headers=headers_alice)
    assert r_me.status_code == 200
    assert r_me.json()["username"] == "alice"
    print(f"  [PASS] Protected profile verified for: {r_me.json()['full_name']}", flush=True)

    # -------------------------------------------------------------
    # 5. Hybrid Search via API (POST /api/v1/query/search)
    # -------------------------------------------------------------
    print("\n[5/7] Testing POST /api/v1/query/search (Engineering Leave Policy)...", flush=True)
    r_search = client.post(
        "/api/v1/query/search",
        headers=headers_alice,
        json={"query": "annual leave carry forward rules", "top_k": 3},
    )
    assert r_search.status_code == 200
    search_data = r_search.json()
    assert len(search_data["chunks"]) > 0
    assert "Leave Policy" in search_data["chunks"][0]["document_title"]
    print(f"  [PASS] Search returned {len(search_data['chunks'])} chunks with citations: {search_data['citations'][0]}", flush=True)

    # -------------------------------------------------------------
    # 6. Admin Login & Audit Logs (RBAC Protection)
    # -------------------------------------------------------------
    print("\n[6/7] Testing RBAC: Alice attempting to access Admin Audit Logs...", flush=True)
    r_forbidden = client.get("/api/v1/audit/logs", headers=headers_alice)
    assert r_forbidden.status_code == 403, f"Expected 403 Forbidden, got {r_forbidden.status_code}"
    print("  [PASS] Employee blocked from Admin audit logs with 403 Forbidden.", flush=True)

    print("\n[7/7] Testing Admin Login & Accessing Audit Logs...", flush=True)
    r_admin_login = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert r_admin_login.status_code == 200
    admin_token = r_admin_login.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    r_audit = client.get("/api/v1/audit/logs", headers=headers_admin)
    assert r_audit.status_code == 200
    logs = r_audit.json()
    assert len(logs) > 0
    print(f"  [PASS] Admin retrieved {len(logs)} audit trail entries! (Latest action: {logs[0]['action']})", flush=True)

    print("\n" + "=" * 75, flush=True)
    print(" ALL 7 FASTAPI ENDPOINT & AUTHENTICATION TESTS PASSED SUCCESSFULLY!", flush=True)
    print("=" * 75 + "\n", flush=True)


if __name__ == "__main__":
    test_api_suite()
