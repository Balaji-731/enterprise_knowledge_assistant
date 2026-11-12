"""Interactive and automated test runner for TechNova Ingestion Pipeline.

Supports:
1. Testing custom user-provided documents (.pdf, .docx, .txt, .md).
2. Automated test suite using generated sample enterprise documents.

Usage:
    # Test a specific file:
    python tests/test_ingestion.py path/to/document.pdf

    # Interactive / Auto-suite mode:
    python tests/test_ingestion.py
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import docx
import pymupdf

from src.ingestion.parsers import extract_document


def print_extraction_report(file_path: Path | str):
    """Run extract_document and print a clean, detailed summary of results."""
    path = Path(file_path).resolve()
    print("\n" + "=" * 70)
    print(f" INGESTION TEST REPORT: {path.name}")
    print("=" * 70)

    if not path.is_file():
        print(f"[-] ERROR: File not found at {path}")
        return

    try:
        pages, file_hash, detection = extract_document(path)
    except Exception as e:
        print(f"[-] EXTRACTION FAILED: {e}")
        return

    print("\n--- FILE INFORMATION ---")
    print(f"  * File Path:       {path}")
    print(f"  * File Size:       {path.stat().st_size:,} bytes")
    print(f"  * SHA-256 Hash:    {file_hash}")

    print("\n--- DETECTED METADATA ---")
    print(f"  * Document Title:  {detection.detected_title}")
    print(f"  * Document Code:   {detection.doc_code or 'N/A'}")
    print(f"  * Detected Version:{detection.detected_version}")
    print(f"  * Document Owner:  {detection.document_owner or 'N/A'}")
    print(f"  * Classification:  {detection.classification or 'N/A'}")
    print(f"  * Effective Date:  {detection.effective_date or 'N/A'}")
    print(f"  * Detection Source:{detection.detection_source}")
    print(f"  * Confidence:      {detection.confidence * 100:.0f}%")

    print("\n--- EXTRACTED CONTENT SUMMARY ---")
    print(f"  * Total Pages:     {len(pages)}")
    total_chars = sum(p.char_count for p in pages)
    print(f"  * Total Characters:{total_chars:,}")

    print("\n--- PAGE PREVIEW (First 2 Pages) ---")
    for page in pages[:2]:
        preview = page.text[:300].replace("\n", " ")
        if len(page.text) > 300:
            preview += "..."
        print(f"  [Page {page.page_number}] ({page.char_count} chars):")
        print(f"    \"{preview}\"\n")

    print("=" * 70)
    print(" [+] TEST COMPLETED SUCCESSFULLY")
    print("=" * 70 + "\n")


def generate_sample_documents(temp_dir: Path) -> dict[str, Path]:
    """Generate mock enterprise PDF, DOCX, and MD files for automatic testing."""
    temp_dir.mkdir(parents=True, exist_ok=True)
    sample_files = {}

    # 1. Create Sample PDF Document
    pdf_path = temp_dir / "TechNova_Operations_Policy_v2.1.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text(
        (50, 50),
        "Document Code: TN-OPS-POL-003\n"
        "Document Title: Operations & Business Continuity Policy\n"
        "Version: 2.1\n"
        "Document Owner: Operations Department\n"
        "Classification: Internal — Operations\n"
        "Effective Date: 01 April 2026\n\n"
        "1. Executive Summary\n"
        "This policy outlines operational business continuity protocols for TechNova systems..."
    )
    doc.save(pdf_path)
    doc.close()
    sample_files["PDF"] = pdf_path

    # 2. Create Sample Word DOCX Document
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
        "All microservices must enforce zero-trust authentication using JWT tokens and mTLS encryption."
    )
    doc.save(docx_path)
    sample_files["DOCX"] = docx_path

    # 3. Create Sample Markdown Document
    md_path = temp_dir / "finance_travel_reimbursement.md"
    md_content = """Document Code: TN-FIN-POL-007
Document Title: Employee Travel & Expense Reimbursement Policy
Version: 1.5
Document Owner: Finance & Accounting

# Expense Policy Guidelines
1. All international business travel must receive pre-approval from department managers.
2. Meal allowances are capped at $75 per day.
"""
    md_path.write_text(md_content, encoding="utf-8")
    sample_files["MD"] = md_path

    return sample_files


def run_automated_test_suite():
    """Run extraction tests on auto-generated sample PDF, DOCX, and MD files."""
    print("\n[RUNNING AUTOMATED INGESTION TEST SUITE ON SAMPLE DOCUMENTS...]\n")
    temp_dir = Path("temp_test_docs")
    sample_files = generate_sample_documents(temp_dir)

    for doc_type, file_path in sample_files.items():
        print(f"\n[+] Testing {doc_type} file: {file_path.name}")
        print_extraction_report(file_path)

    # Clean up temporary files
    for file_path in sample_files.values():
        if file_path.exists():
            file_path.unlink()
    if temp_dir.exists():
        temp_dir.rmdir()

    print("[+] ALL AUTOMATED TESTS COMPLETED!\n")


def main():
    if len(sys.argv) > 1:
        # User passed a file path argument: python tests/test_ingestion.py path/to/file.pdf
        user_path = Path(sys.argv[1])
        print_extraction_report(user_path)
    else:
        # No path provided: interactive mode
        print("\n==================================================")
        print(" TechNova Ingestion Pipeline Test Runner")
        print("==================================================")
        print("Option 1: Enter a file path to test your own document or PDF.")
        print("Option 2: Press ENTER (or run headless) for auto sample suite.")
        print("--------------------------------------------------")
        
        try:
            user_input = input("Enter file path (or press ENTER for auto tests): ").strip()
        except (EOFError, KeyboardInterrupt):
            user_input = ""

        # Strip surrounding quotes if user dragged & dropped file path into terminal
        user_input = user_input.strip('"').strip("'")

        if user_input:
            print_extraction_report(Path(user_input))
        else:
            run_automated_test_suite()


if __name__ == "__main__":
    main()
