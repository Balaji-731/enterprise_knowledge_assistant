"""Master Ingestion Pipeline Orchestrator for TechNova Enterprise AI.

Combines:
1. Document parsing & SHA-256 hash calculation (parsers.py)
2. Metadata table & version detection (parsers.py)
3. Text cleaning & recurring header removal (cleaner.py)
4. Access policy resolution (policy.py)
5. Structure-aware chunking & context enrichment (chunker.py)
6. Dense vector embedding & ChromaDB/BM25 indexing (indexer.py)
"""

from pathlib import Path
from typing import Optional
from uuid import uuid4

from src.ingestion.cleaner import clean_extracted_pages
from src.ingestion.chunker import chunk_document_pages
from src.ingestion.indexer import KnowledgeIndexer
from src.ingestion.parsers import extract_document
from src.ingestion.policy import resolve_access_policy
from src.ingestion.schemas import (
    AccessPolicy,
    DocumentCategory,
    IngestionResult,
    VersionStatus,
)


class IngestionPipeline:
    """Master pipeline managing end-to-end processing of enterprise documents."""

    def __init__(self, storage_dir: str | Path = "./storage/chroma_db"):
        self.indexer = KnowledgeIndexer(persist_directory=storage_dir)

    def ingest_document(
        self,
        file_path: str | Path,
        category: DocumentCategory | str,
        manual_policy: Optional[AccessPolicy] = None,
        manual_version: Optional[str] = None,
        uploader_id: str = "system_admin",
    ) -> IngestionResult:
        """Run complete ingestion pipeline on a document file."""
        path = Path(file_path).resolve()

        # Step 1: Parse content, compute SHA-256 hash, and run version/title detection
        pages, file_hash, detection = extract_document(path)

        # Determine effective document title & version number
        document_title = detection.detected_title or path.stem.replace("_", " ").title()
        version_number = manual_version or detection.detected_version or "1.0"

        # Step 2: Clean extracted page text & remove recurring header/footer noise
        cleaned_pages = clean_extracted_pages(pages)

        # Step 3: Resolve Access Policy (Default Category Matrix or Manual Override)
        effective_policy = resolve_access_policy(category=category, manual_policy=manual_policy)

        # Generate unique IDs for document family and this version
        # (In production, document_id would be queried from PostgreSQL by doc_code or title)
        doc_code = detection.doc_code or f"DOC-{path.stem.upper()}"
        document_id = str(uuid4())
        version_id = str(uuid4())

        # Normalize category enum
        cat_enum = (
            category if isinstance(category, DocumentCategory)
            else DocumentCategory(category.upper())
        )

        # Step 4: Intelligent structure-aware chunking
        chunks = chunk_document_pages(
            pages=cleaned_pages,
            document_id=document_id,
            version_id=version_id,
            document_title=document_title,
            category=cat_enum.value,
            version_number=version_number,
            access_policy=effective_policy,
            status=VersionStatus.ACTIVE,
            is_active=True,
        )

        # Step 5: Embed & index chunks into ChromaDB
        self.indexer.index_chunks(chunks)

        # Step 6: Update metadata flags to archive prior versions of this document family
        self.indexer.set_previous_versions_inactive(
            document_id=document_id,
            active_version_id=version_id,
        )

        # Step 7: Return structured summary report
        return IngestionResult(
            document_id=document_id,
            version_id=version_id,
            document_title=document_title,
            version_number=version_number,
            category=cat_enum,
            total_pages=len(cleaned_pages),
            total_chunks=len(chunks),
            file_hash=file_hash,
            status=VersionStatus.ACTIVE,
            access_policy=effective_policy,
        )
