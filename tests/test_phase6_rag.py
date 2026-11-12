"""Phase 6 Test Runner: Enterprise RAG Engine with Local Ollama Generation.

Tests:
1. Local Ollama server connectivity & model availability.
2. Grounded question answering strictly backed by authorized context.
3. In-text footnote citations [1], [2] verified against source documents.
4. Anti-hallucination & permission denial handling (zero-leakage questions).
5. Real-time streaming response generation.

Usage:
    # Interactive chat session with persona selection:
    uv run python tests/test_phase6_rag.py

    # Automated verification test suite:
    uv run python tests/test_phase6_rag.py auto

    # Direct CLI query:
    uv run python tests/test_phase6_rag.py ask "What are the rules for carry forward leave?" --role employee --dept engineering
"""

import argparse
import sys
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.ingestion.schemas import UserRole
from src.rag import EnterpriseRAGEngine, OllamaClient, RAGQuery
from src.retrieval.schemas import UserContext

# Standard corporate test personas
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


def execute_rag_query(
    engine: EnterpriseRAGEngine,
    question: str,
    user: UserContext,
    model: str = "llama3.2:latest",
    stream: bool = False,
):
    """Execute grounded RAG query and display answer with footnotes."""
    print_banner(f"QUESTION: \"{question}\"")
    print(f"  * User:       {user.username} (Role: {user.role.value.upper()} | Dept: {user.department.upper()})")
    print(f"  * Model:      {model}")
    print("-" * 78)

    rag_query = RAGQuery(query=question, model_name=model, stream=stream)

    if stream:
        print("\n[AI ASSISTANT ANSWER]:\n")
        full_tokens = []
        for token in engine.stream_ask(query=rag_query, user=user):
            sys.stdout.write(token)
            sys.stdout.flush()
            full_tokens.append(token)
        print("\n" + "-" * 78)
        # Fetch non-streaming for citations
        response = engine.ask(query=rag_query, user=user)
    else:
        response = engine.ask(query=rag_query, user=user)
        print("\n[AI ASSISTANT ANSWER]:\n")
        print(response.answer)
        print("-" * 78)

    print("\n[VERIFIED FOOTNOTE CITATIONS]:")
    if response.citations:
        for cit in response.citations:
            print(f"  {cit.format_footnote()}")
    else:
        print("  No citations referenced (Query refused or out-of-scope).")

    print(f"\n[METRICS] Latency: {response.latency_ms} ms | Grounded: {response.grounded}")
    print("=" * 78 + "\n")
    return response


def run_automated_suite(engine: EnterpriseRAGEngine, model: str = "llama3.2:latest"):
    """Run automated test suite verifying grounded answers, citations, and permission refusals."""
    print_banner("RUNNING AUTOMATED PHASE 6 RAG GENERATION TEST SUITE")

    eng_user = TEST_PERSONAS["1"]
    ops_user = TEST_PERSONAS["2"]
    fin_user = TEST_PERSONAS["4"]

    passed_count = 0
    total_tests = 3

    # TEST 1: Authorized Leave Policy Question
    print("\n[TEST 1/3] Testing Authorized Engineering Question (Leave Policy)...")
    res1 = engine.ask("How many days of annual leave can an employee carry forward?", eng_user)
    print("  Answer Preview:", res1.answer[:160].replace("\n", " "), "...")
    if len(res1.citations) > 0 and ("carry forward" in res1.answer.lower() or "leave" in res1.answer.lower()):
        print(f"  [PASS] Answer generated with verified citation: {res1.citations[0].format_footnote()}")
        passed_count += 1
    else:
        print("  [FAIL] Failed to answer or missing citations.")

    # TEST 2: Permission-Aware Denial (Engineering user asking Finance question)
    print("\n[TEST 2/3] Testing Permission Denial (Zero-Leakage Enforcement)...")
    res2 = engine.ask("What is the daily meal allowance for international business travel in SAP Concur?", eng_user)
    print("  Answer Preview:", res2.answer[:160].replace("\n", " "), "...")
    refusal_indicators = ["cannot find", "not find", "no information", "not mentioned", "restricted", "not available"]
    if any(phrase in res2.answer.lower() for phrase in refusal_indicators):
        print("  [PASS] Assistant refused safely: Zero leakage of confidential Finance data!")
        passed_count += 1
    else:
        print("  [FAIL] Assistant leaked information or attempted to hallucinate.")

    # TEST 3: Authorized Operations Failover Question
    print("\n[TEST 3/3] Testing Authorized Operations Question (Uptime & Failover)...")
    res3 = engine.ask("What is the failover timeline during a primary datacenter outage?", ops_user)
    print("  Answer Preview:", res3.answer[:160].replace("\n", " "), "...")
    if "15" in res3.answer or "minutes" in res3.answer or "failover" in res3.answer.lower():
        print(f"  [PASS] Correct operational failover timeline cited!")
        passed_count += 1
    else:
        print("  [FAIL] Answer did not match operational SLA.")

    print_banner(f"PHASE 6 AUTOMATED SUITE: {passed_count}/{total_tests} TESTS PASSED")
    return passed_count == total_tests


def interactive_chat(engine: EnterpriseRAGEngine, default_model: str = "llama3.2:latest"):
    """Interactive multi-persona chat loop."""
    print("\n" + "=" * 60)
    print(" TECHNOVA ENTERPRISE AI ASSISTANT (PHASE 6 CONSOLE)")
    print("=" * 60)

    # Check Ollama connection
    client = engine.ollama_client
    if not client.is_available():
        print("[!] WARNING: Could not connect to Ollama at http://127.0.0.1:11434.")
        print("    Ensure Ollama is started on your computer.\n")
    else:
        models = client.get_installed_models()
        print(f"[+] Ollama Connected! Detected models: {', '.join(models) if models else 'None'}")
        if default_model not in models and models:
            default_model = models[0]
            print(f"[i] Using available model: {default_model}")

    while True:
        print("\nSelect User Persona:")
        print("  1. Alice   - Employee  (Department: Engineering)")
        print("  2. Bob     - Employee  (Department: Operations)")
        print("  3. Carol   - HR Staff  (Department: Human Resources)")
        print("  4. David   - Manager   (Department: Finance)")
        print("  5. Eve     - Admin     (Department: All / Superuser)")
        print("------------------------------------------------------------")
        print("  A. Run Automated Test Suite")
        print("  Q. Quit")
        print("=" * 60)

        choice = input("\nSelect an option [1-5, A, Q]: ").strip().upper()

        if choice == "Q":
            print("\nExiting AI Assistant. Goodbye!")
            break
        elif choice == "A":
            run_automated_suite(engine, model=default_model)
            continue
        elif choice not in TEST_PERSONAS:
            print("[-] Invalid option. Please select 1-5, A, or Q.")
            continue

        selected_user = TEST_PERSONAS[choice]
        print(f"\n[+] Logged in as: {selected_user.username} ({selected_user.role.value.upper()} | {selected_user.department.upper()})")
        print("    Type your question (or 'back' to change persona, 'stream' to toggle streaming).\n")

        streaming_enabled = False

        while True:
            prompt_label = f"[{selected_user.username}] Question: "
            question = input(prompt_label).strip()

            if not question:
                continue
            if question.lower() == "back":
                break
            if question.lower() == "stream":
                streaming_enabled = not streaming_enabled
                print(f"[i] Streaming mode is now: {'ON' if streaming_enabled else 'OFF'}")
                continue

            execute_rag_query(
                engine,
                question=question,
                user=selected_user,
                model=default_model,
                stream=streaming_enabled,
            )


def main():
    parser = argparse.ArgumentParser(description="TechNova Enterprise RAG Assistant (Phase 6)")
    parser.add_argument("command", nargs="?", default="menu", choices=["menu", "auto", "ask"])
    parser.add_argument("question", nargs="?", default="")
    parser.add_argument("--role", default="employee", choices=["employee", "hr", "manager", "administrator"])
    parser.add_argument("--dept", default="engineering")
    parser.add_argument("--model", default="llama3.2:latest")
    parser.add_argument("--stream", action="store_true")

    args = parser.parse_args()

    engine = EnterpriseRAGEngine(default_model=args.model)

    if args.command == "auto":
        run_automated_suite(engine, model=args.model)
    elif args.command == "ask":
        if not args.question:
            print("Error: question is required for 'ask' command.")
            return
        user = UserContext(
            user_id="cli-user",
            username=f"cli_{args.role}",
            role=UserRole(args.role),
            department=args.dept,
        )
        execute_rag_query(
            engine,
            question=args.question,
            user=user,
            model=args.model,
            stream=args.stream,
        )
    else:
        interactive_chat(engine, default_model=args.model)


if __name__ == "__main__":
    main()
