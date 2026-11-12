"""Phase 5 Test Runner: Secure Hybrid Retrieval & Permission Engine.

Tests:
1. Pre-retrieval permission filtering (RBAC + ABAC + User grants).
2. Dense semantic search (ChromaDB + SentenceTransformers).
3. Sparse keyword search (BM25).
4. Reciprocal Rank Fusion (RRF).
5. Cross-Encoder reranking (ms-marco-MiniLM-L-6-v2).
6. Defense-in-depth authorization validation (zero-leakage check).
7. Verifiable source citation generation.

Usage:
    # Run full interactive menu (choose user persona & test queries):
    uv run python tests/test_phase5_retrieval.py

    # Run automated security & hybrid test suite:
    uv run python tests/test_phase5_retrieval.py auto

    # Quick command-line query as a specific user persona:
    uv run python tests/test_phase5_retrieval.py search "failover procedures" --role employee --dept operations
"""

import argparse
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.ingestion.schemas import UserRole
from src.retrieval import (
    RetrievalQuery,
    SecureHybridRetrievalEngine,
    UserContext,
)

# Standard test personas representing TechNova's organizational hierarchy
TEST_PERSONAS = {
    "1": UserContext(
        user_id="usr-eng-001",
        username="alice_eng",
        role=UserRole.EMPLOYEE,
        department="engineering",
    ),
    "2": UserContext(
        user_id="usr-ops-002",
        username="bob_ops",
        role=UserRole.EMPLOYEE,
        department="operations",
    ),
    "3": UserContext(
        user_id="usr-hr-003",
        username="carol_hr",
        role=UserRole.HR,
        department="hr",
    ),
    "4": UserContext(
        user_id="usr-fin-004",
        username="david_finance_mgr",
        role=UserRole.MANAGER,
        department="finance",
    ),
    "5": UserContext(
        user_id="usr-admin-000",
        username="eve_admin",
        role=UserRole.ADMINISTRATOR,
        department="all",
    ),
}


def print_banner(title: str):
    print("\n" + "=" * 78)
    print(f" {title}")
    print("=" * 78)


def execute_test_query(
    engine: SecureHybridRetrievalEngine,
    query: str,
    user: UserContext,
    top_k: int = 3,
    include_historical: bool = False,
):
    """Execute a query and display detailed scoring, permission, and citation breakdown."""
    print_banner(f"QUERY: \"{query}\"")
    print(f"  * User:       {user.username} (ID: {user.user_id})")
    print(f"  * Role:       {user.role.value.upper()}")
    print(f"  * Department: {user.department.upper()}")
    print(f"  * Historical: {'Allowed (HR/Manager/Admin only)' if include_historical else 'Disabled (Active only)'}")
    print("-" * 78)

    query_spec = RetrievalQuery(
        query=query,
        top_k=top_k,
        include_historical=include_historical,
    )

    response = engine.retrieve(query=query_spec, user=user)

    audit = response.audit_metadata
    print("\n[RETRIEVAL PIPELINE METRICS]")
    print(f"  * Total Eligible Candidates Authorized: {audit.get('pre_filter_authorized_count', 0)}")
    print(f"  * Dense Semantic Matches:              {audit.get('dense_hits', 0)}")
    print(f"  * Sparse BM25 Keyword Matches:         {audit.get('sparse_hits', 0)}")
    print(f"  * Post-Retrieval Leaks Dropped:        {audit.get('post_filter_dropped', 0)}")
    print(f"  * Execution Latency:                   {audit.get('duration_ms', 0)} ms")

    if not response.chunks:
        print("\n[-] NO AUTHORIZED CHUNKS RETURNED.")
        print("    (Either no relevant documents exist, or access is restricted for your role/department)")
        print("=" * 78 + "\n")
        return response

    print(f"\n[+] RETRIEVED {len(response.chunks)} AUTHORIZED & RERANKED CHUNKS:\n")

    for rank, chunk in enumerate(response.chunks, start=1):
        print(f"--- [Result #{rank}] ---------------------------------------------------------")
        print(f"  * Document:      {chunk.document_title} (Version: {chunk.version_number})")
        print(f"  * Section:       {chunk.section_header or 'General'}")
        print(f"  * Source Page:   Page {chunk.page_number}")
        print(f"  * Category:      {chunk.category}")
        print(f"  * Access Policy: Roles=[{chunk.allowed_roles}] | Depts=[{chunk.allowed_departments}]")
        print(f"  * Dense Score:   {chunk.dense_score:.4f} | BM25 Score: {chunk.sparse_score:.4f}")
        print(f"  * RRF Score:     {chunk.rrf_score:.4f} | Cross-Encoder Rerank: {chunk.rerank_score:.4f}")
        print(f"  * Citation Tag:  {chunk.format_citation()}")
        print("\n  [Passage Preview]:")
        for line in chunk.text.splitlines()[:6]:
            print(f"    {line}")
        if len(chunk.text.splitlines()) > 6:
            print("    ...")
        print()

    print("-" * 78)
    print("[FINAL AUTHORIZED CONTEXT SENT TO LLM]:")
    print(response.authorized_context[:400] + ("..." if len(response.authorized_context) > 400 else ""))
    print("=" * 78 + "\n")

    return response


def run_automated_security_suite(engine: SecureHybridRetrievalEngine):
    """Run automated verification suite testing all security and retrieval gates."""
    print_banner("RUNNING AUTOMATED PHASE 5 SECURITY & RETRIEVAL VERIFICATION")

    passed_tests = 0
    total_tests = 5

    eng_user = TEST_PERSONAS["1"]
    ops_user = TEST_PERSONAS["2"]
    fin_user = TEST_PERSONAS["4"]
    admin_user = TEST_PERSONAS["5"]

    # -------------------------------------------------------------
    # TEST 1: Cross-Department Boundary Isolation (Zero Leakage)
    # -------------------------------------------------------------
    print("\n[TEST 1/5] Checking Department Boundary Isolation...")
    # Engineering user searches for confidential Finance travel meal allowance
    res1 = engine.retrieve("SAP Concur daily meal allowance travel reimbursement", eng_user)
    has_finance = any(
        "finance" in c.category.lower() or "FIN" in c.document_title
        for c in res1.chunks
    )
    if not has_finance:
        print("  [PASS] Engineering employee CANNOT access Finance policies. (Zero leakage)")
        passed_tests += 1
    else:
        print("  [FAIL] Leakage detected! Finance chunk returned to Engineering user.")

    # -------------------------------------------------------------
    # TEST 2: Department-Authorized Semantic Retrieval
    # -------------------------------------------------------------
    print("\n[TEST 2/5] Checking Authorized Operations Retrieval...")
    res2 = engine.retrieve("What is the failover timeline during a primary datacenter outage?", ops_user)
    has_ops = any("operations" in c.category.lower() or "OPS" in c.text for c in res2.chunks)
    if has_ops and len(res2.chunks) > 0:
        print(f"  [PASS] Operations employee successfully retrieved Operations Policy (Top score: {res2.chunks[0].rerank_score:.3f})")
        passed_tests += 1
    else:
        print("  [FAIL] Operations employee could not retrieve Operations Policy.")

    # -------------------------------------------------------------
    # TEST 3: Hybrid Search (Sparse BM25 + Dense Semantic Synergy)
    # -------------------------------------------------------------
    print("\n[TEST 3/5] Checking Exact Keyword / Code Match (BM25 + Dense)...")
    res3 = engine.retrieve("TN-ENG-SEC-012 JWT tokens mTLS", eng_user)
    has_code = any("TN-ENG-SEC-012" in c.text for c in res3.chunks)
    if has_code:
        print(f"  [PASS] Exact code 'TN-ENG-SEC-012' retrieved with BM25 score {res3.chunks[0].sparse_score:.2f}")
        passed_tests += 1
    else:
        print("  [FAIL] Failed to retrieve exact document code.")

    # -------------------------------------------------------------
    # TEST 4: Historical Version Gating
    # -------------------------------------------------------------
    print("\n[TEST 4/5] Checking Historical Version Access Gating...")
    # Employee attempts to view historical versions
    res4_emp = engine.retrieve(
        RetrievalQuery(query="Leave policy rules", include_historical=True),
        eng_user,
    )
    # Admin attempts to view historical versions
    res4_admin = engine.retrieve(
        RetrievalQuery(query="Leave policy rules", include_historical=True),
        admin_user,
    )
    emp_has_archived = any(not c.is_active for c in res4_emp.chunks)
    if not emp_has_archived:
        print("  [PASS] Standard employee blocked from archived versions even when requested.")
        passed_tests += 1
    else:
        print("  [FAIL] Employee accessed archived historical chunks.")

    # -------------------------------------------------------------
    # TEST 5: Verifiable Citation Formatting
    # -------------------------------------------------------------
    print("\n[TEST 5/5] Checking Citation Metadata Structure...")
    res5 = engine.retrieve("annual leave carry forward days", eng_user)
    if res5.citations and "Document:" in res5.citations[0] and "Page:" in res5.citations[0]:
        print(f"  [PASS] Citation verified: \"{res5.citations[0]}\"")
        passed_tests += 1
    else:
        print("  [FAIL] Citations malformed or missing.")

    print_banner(f"VERIFICATION SUMMARY: {passed_tests}/{total_tests} TESTS PASSED")
    return passed_tests == total_tests


def interactive_menu(engine: SecureHybridRetrievalEngine):
    """Run interactive terminal menu to test queries under different roles."""
    while True:
        print("\n" + "=" * 60)
        print(" TECHNOVA SECURE HYBRID RETRIEVAL TEST CONSOLE")
        print("=" * 60)
        print("Select User Persona:")
        print("  1. Alice   - Employee  (Department: Engineering)")
        print("  2. Bob     - Employee  (Department: Operations)")
        print("  3. Carol   - HR Staff  (Department: Human Resources)")
        print("  4. David   - Manager   (Department: Finance)")
        print("  5. Eve     - Admin     (Department: All / Superuser)")
        print("------------------------------------------------------------")
        print("  A. Run Full Automated Security Suite")
        print("  Q. Quit")
        print("=" * 60)

        choice = input("\nSelect an option [1-5, A, Q]: ").strip().upper()

        if choice == "Q":
            print("\nExiting retrieval test console. Goodbye!")
            break
        elif choice == "A":
            run_automated_security_suite(engine)
            continue
        elif choice not in TEST_PERSONAS:
            print("[-] Invalid option. Please select 1-5, A, or Q.")
            continue

        selected_user = TEST_PERSONAS[choice]
        print(f"\n[+] Active Persona: {selected_user.username} ({selected_user.role.value.upper()} - {selected_user.department.upper()})")

        while True:
            query = input("\nEnter search question (or press Enter to return to personas): ").strip()
            if not query:
                break

            execute_test_query(engine, query=query, user=selected_user)


def main():
    parser = argparse.ArgumentParser(description="Test Secure Hybrid Retrieval Engine (Phase 5)")
    parser.add_argument("command", nargs="?", default="menu", choices=["menu", "auto", "search"])
    parser.add_argument("query", nargs="?", default="")
    parser.add_argument("--role", default="employee", choices=["employee", "hr", "manager", "administrator"])
    parser.add_argument("--dept", default="engineering")
    parser.add_argument("--historical", action="store_true", help="Include archived versions")

    args = parser.parse_args()

    engine = SecureHybridRetrievalEngine()

    if args.command == "auto":
        run_automated_security_suite(engine)
    elif args.command == "search":
        if not args.query:
            print("Error: query string is required for 'search' command.")
            return
        user = UserContext(
            user_id="cli-user",
            username=f"cli_{args.role}",
            role=UserRole(args.role),
            department=args.dept,
        )
        execute_test_query(
            engine,
            query=args.query,
            user=user,
            include_historical=args.historical,
        )
    else:
        interactive_menu(engine)


if __name__ == "__main__":
    main()
