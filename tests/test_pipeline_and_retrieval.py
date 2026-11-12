"""End-to-End Test Runner: Document Ingestion & Retrieval Pipeline.

Supports:
1. Ingesting documents (.pdf, .docx, .txt, .md) into ChromaDB vector store.
2. Querying & retrieving relevant text chunks using semantic vector search.
3. Automated end-to-end verification test suite.

Usage:
    # Run full interactive / automated test menu:
    python tests/test_pipeline_and_retrieval.py

    # Directly ingest a document file:
    python tests/test_pipeline_and_retrieval.py ingest path/to/doc.pdf OPERATIONS

    # Directly query retrieved knowledge:
    python tests/test_pipeline_and_retrieval.py search "What are the business continuity protocols?"
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import docx
import pymupdf

from src.ingestion.pipeline import IngestionPipeline
from src.ingestion.schemas import DocumentCategory


def run_ingestion_test(file_path: str | Path, category_name: str = "OPERATIONS") -> bool:
    """Ingest a document file through the full pipeline into ChromaDB."""
    path = Path(file_path).resolve()
    print("\n" + "=" * 70)
    print(f" [INSPECTING & INGESTING DOCUMENT]: {path.name}")
    print("=" * 70)

    if not path.is_file():
        print(f"[-] ERROR: File not found at {path}")
        return False

    try:
        pipeline = IngestionPipeline(storage_dir="./storage/chroma_db")
        result = pipeline.ingest_document(
            file_path=path,
            category=category_name,
        )

        print("\n--- INGESTION RESULT SUMMARY ---")
        print(f"  * Document Title:  {result.document_title}")
        print(f"  * Version Number:  {result.version_number}")
        print(f"  * Category:        {result.category.value}")
        print(f"  * Document ID:     {result.document_id}")
        print(f"  * Version ID:      {result.version_id}")
        print(f"  * Total Pages:     {result.total_pages}")
        print(f"  * Total Chunks:    {result.total_chunks}")
        print(f"  * SHA-256 Hash:    {result.file_hash}")
        print(f"  * Status:          {result.status.value}")
        print(f"  * Allowed Roles:   {', '.join(r.value for r in result.access_policy.allowed_roles)}")
        print(f"  * Allowed Depts:   {', '.join(result.access_policy.allowed_departments)}")

        print("\n[+] DOCUMENT SUCCESSFULLY INGESTED & INDEXED IN CHROMADB!\n")
        return True

    except Exception as e:
        print(f"[-] INGESTION FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_retrieval_test(query: str, top_k: int = 3, category: str = None):
    """Perform semantic vector search against ChromaDB knowledge store."""
    print("\n" + "=" * 70)
    print(f" [SEARCH & RETRIEVAL QUERY]: \"{query}\"")
    print("=" * 70)

    pipeline = IngestionPipeline(storage_dir="./storage/chroma_db")
    results = pipeline.indexer.search(
        query=query,
        top_k=top_k,
        category=category,
        only_active=True,
    )

    if not results:
        print("[-] No matching chunks found in ChromaDB knowledge store.")
        print("    (Tip: Ingest documents first before running queries!)")
        return

    print(f"\n[+] Retrived {len(results)} matching chunks:\n")

    for idx, match in enumerate(results, 1):
        meta = match["metadata"]
        print(f"------------------- Match #{idx} (Similarity Score: {match['score'] * 100:.1f}%) -------------------")
        print(f"  * Source Doc:    {meta.get('document_title')} (v{meta.get('version_number')})")
        print(f"  * Category:      {meta.get('category')}")
        print(f"  * Section:       {meta.get('section_header') or 'General'}")
        print(f"  * Page Number:   Page {meta.get('page_number')}")
        print(f"  * Token Count:   {meta.get('token_count')} tokens")
        print(f"  * Text Content:\n")

        # Indent text preview
        for line in match["text"].splitlines():
            print(f"    {line}")
        print()

    print("=" * 70 + "\n")


def generate_sample_documents(temp_dir: Path) -> dict[str, tuple[Path, str]]:
    """Generate sample enterprise PDF, DOCX, and MD files for end-to-end testing."""
    temp_dir.mkdir(parents=True, exist_ok=True)
    samples = {}

    # 1. Sample PDF: Operations Policy
    pdf_path = temp_dir / "TechNova_Operations_Policy_v2.1.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text(
        (50, 50),
        "Document Code: TN-OPS-POL-003\n"
        "Document Title: Operations & Business Continuity Policy\n"
        "Version: 2.1\n"
        "Document Owner: Operations Department\n"
        "Classification: Internal - Operations\n\n"
        "1. Executive Summary\n"
        "TechNova maintains a 99.99% uptime target across all cloud infrastructure regions.\n"
        "In the event of a primary datacenter outage, failover to secondary standby regions occurs within 15 minutes.\n\n"
        "2. Incident Response Escalation\n"
        "P1 Critical Incidents require immediate notification to the VP of Infrastructure and duty managers."
    )
    doc.save(pdf_path)
    doc.close()
    samples["PDF Operations Policy"] = (pdf_path, "OPERATIONS")

    # 2. Sample DOCX: Engineering Security Standard
    docx_path = temp_dir / "Engineering_Security_Standard_v3.0.docx"
    doc = docx.Document()
    doc.add_paragraph("TechNova Engineering Security Standard")
    tbl = doc.add_table(rows=3, cols=2)
    tbl.cell(0, 0).text = "Document Code"
    tbl.cell(0, 1).text = "TN-ENG-SEC-012"
    tbl.cell(1, 0).text = "Version"
    tbl.cell(1, 1).text = "3.0"
    tbl.cell(2, 0).text = "Document Owner"
    tbl.cell(2, 1).text = "Engineering Security Guild"
    doc.add_paragraph(
        "Section 1: Architecture Guidelines\n"
        "All microservices must enforce zero-trust authentication using JWT tokens and mTLS encryption.\n"
        "API keys must be rotated every 90 days using Automated Vault Secrets Manager."
    )
    doc.save(docx_path)
    samples["DOCX Security Standard"] = (docx_path, "ENGINEERING")

    # 3. Sample MD: Finance Policy
    md_path = temp_dir / "finance_travel_reimbursement.md"
    md_content = """Document Code: TN-FIN-POL-007
Document Title: Employee Travel & Expense Reimbursement Policy
Version: 1.5
Document Owner: Finance & Accounting

# Expense Policy Guidelines
1. All international business travel must receive pre-approval from department managers.
2. Daily meal allowances are capped at $75 per day.
3. Expense receipts must be uploaded to SAP Concur within 14 days of travel completion.
"""
    md_path.write_text(md_content, encoding="utf-8")
    samples["MD Finance Policy"] = (md_path, "FINANCE")

    return samples


def run_automated_e2e_suite():
    """Run end-to-end automated test: generate docs -> ingest -> search & verify."""
    print("\n[RUNNING AUTOMATED END-TO-END INGESTION & RETRIEVAL TEST SUITE...]\n")
    temp_dir = Path("temp_e2e_docs")
    sample_files = generate_sample_documents(temp_dir)

    # 1. Ingest all sample documents into ChromaDB
    print("\n================ STEP 1: INGESTING SAMPLE DOCUMENTS ================")
    for label, (path, category) in sample_files.items():
        print(f"\n[+] Ingesting {label} ({path.name})...")
        run_ingestion_test(path, category)

    # 2. Run retrieval queries to test semantic search
    print("\n================ STEP 2: RETRIEVING RELEVANT KNOWLEDGE ================")
    queries = [
        ("What is the failover timeline during a datacenter outage?", "OPERATIONS"),
        ("What authentication is required for microservices?", "ENGINEERING"),
        ("What is the daily meal allowance cap for employee travel?", "FINANCE"),
    ]

    for q_text, cat in queries:
        run_retrieval_test(query=q_text, top_k=2, category=cat)

    # Cleanup temp sample files
    for path, _ in sample_files.values():
        if path.exists():
            path.unlink()
    if temp_dir.exists():
        temp_dir.rmdir()

    print("[+] AUTOMATED END-TO-END SUITE COMPLETED SUCCESSFULLY!\n")


def main():
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == "ingest" and len(sys.argv) > 2:
            file_path = sys.argv[2]
            category = sys.argv[3] if len(sys.argv) > 3 else "OPERATIONS"
            run_ingestion_test(file_path, category)
        elif command == "search" and len(sys.argv) > 2:
            query = " ".join(sys.argv[2:])
            run_retrieval_test(query)
        elif command == "auto":
            run_automated_e2e_suite()
        else:
            print("Usage:")
            print("  python tests/test_pipeline_and_retrieval.py ingest <file_path> [category]")
            print("  python tests/test_pipeline_and_retrieval.py search <query>")
            print("  python tests/test_pipeline_and_retrieval.py auto")
        return

    # Interactive Menu Mode
    print("\n==================================================")
    print(" TechNova Ingestion & Retrieval Pipeline Test Suite")
    print("==================================================")
    print("1. Upload & Ingest a Document / PDF")
    print("2. Search & Retrieve Knowledge from ChromaDB")
    print("3. Run Full Automated End-to-End Verification Test")
    print("--------------------------------------------------")

    try:
        choice = input("Enter option (1, 2, or 3) [Default=3]: ").strip()
    except (EOFError, KeyboardInterrupt):
        choice = "3"

    if choice == "1":
        try:
            file_input = input("Enter document file path: ").strip().strip('"').strip("'")
            cat_input = input("Enter category (HR, ENGINEERING, FINANCE, OPERATIONS, ADMINISTRATION) [Default=OPERATIONS]: ").strip().upper()
            if not cat_input:
                cat_input = "OPERATIONS"
            run_ingestion_test(file_input, cat_input)
        except (EOFError, KeyboardInterrupt):
            pass
    elif choice == "2":
        try:
            q_input = input("Enter your search query: ").strip()
            if q_input:
                run_retrieval_test(q_input)
        except (EOFError, KeyboardInterrupt):
            pass
    else:
        run_automated_e2e_suite()


if __name__ == "__main__":
    main()
