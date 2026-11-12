"""ChromaDB & Chunking Visual Inspector for TechNova Enterprise AI.

Shows:
1. How text is split into semantic chunks with context headers & section detection.
2. Exact structure of documents, metadata, and embeddings stored inside ChromaDB.

Usage:
    python tests/inspect_chroma_chunks.py
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import chromadb


def inspect_chromadb_storage(persist_directory: str = "./storage/chroma_db"):
    """Inspect and display all collections, documents, metadata, and embeddings in ChromaDB."""
    db_path = Path(persist_directory).resolve()
    print("\n" + "=" * 75)
    print(" CHROMADB STORAGE & CHUNK INSPECTOR")
    print("=" * 75)
    print(f" Database Path: {db_path}")

    if not db_path.exists():
        print("[-] Database directory does not exist yet. Please ingest a document first!")
        return

    client = chromadb.PersistentClient(path=str(db_path))
    collections = client.list_collections()

    if not collections:
        print("[-] No collections found in ChromaDB.")
        return

    print(f" Total Collections Found: {len(collections)}")

    for coll_info in collections:
        coll = client.get_collection(coll_info.name)
        total_items = coll.count()

        print(f"\n---------------------------------------------------------------------------")
        print(f" Collection Name: '{coll.name}' | Total Stored Chunks: {total_items}")
        print(f"---------------------------------------------------------------------------")

        if total_items == 0:
            print("  (Collection is currently empty)")
            continue

        data = coll.get(include=["documents", "metadatas", "embeddings"])
        ids = data["ids"]
        docs = data["documents"]
        metas = data["metadatas"]
        embeddings = data["embeddings"]

        for idx, (chunk_id, text, meta, emb) in enumerate(zip(ids, docs, metas, embeddings), 1):
            print(f"\n [CHUNK #{idx}] (ID: {chunk_id[:8]}...)")
            print(f"  +-- METADATA STORED IN CHROMADB:")
            print(f"  |   * Document Title:  {meta.get('document_title')}")
            print(f"  |   * Document ID:     {meta.get('document_id')}")
            print(f"  |   * Version:         v{meta.get('version_number')} (ID: {meta.get('version_id')[:8]}...)")
            print(f"  |   * Category:        {meta.get('category')}")
            print(f"  |   * Active Status:   {meta.get('is_active')} ({meta.get('status')})")
            print(f"  |   * Page Number:     Page {meta.get('page_number')}")
            print(f"  |   * Section Header:  {meta.get('section_header') or 'General'}")
            print(f"  |   * RBAC Roles:      [{meta.get('allowed_roles')}]")
            print(f"  |   * RBAC Depts:      [{meta.get('allowed_departments')}]")
            print(f"  |   * Token Count:     {meta.get('token_count')} tokens")

            if emb is not None and len(emb) > 0:
                vector_preview = ", ".join(f"{v:.4f}" for v in emb[:5])
                print(f"  +-- DENSE VECTOR EMBEDDING ({len(emb)} dimensions):")
                print(f"  |   * First 5 dimensions: [{vector_preview}, ...]")

            print(f"  +-- STORED TEXT BODY (with Context Prefix):")
            for line in text.splitlines():
                print(f"      {line}")
            print()

    print("=" * 75)
    print(" [+] INSPECTION COMPLETED")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    inspect_chromadb_storage()
