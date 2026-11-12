"""Knowledge Indexer module for TechNova Ingestion Pipeline.

Manages dual indexing for hybrid search:
1. Dense Vector Storage: ChromaDB + SentenceTransformers (all-MiniLM-L6-v2).
2. Sparse Keyword Index: BM25 (rank_bm25) corpus builder.
3. Version Lifecycle Promotion: Updates vector store metadata flags (is_active) when new versions are promoted.
"""

import os
from pathlib import Path
from typing import List, Optional

import chromadb
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

from src.ingestion.schemas import Chunk

# Global embedding model instance cache (lazy load)
_EMBEDDING_MODEL: Optional[SentenceTransformer] = None


def get_embedding_model(model_name: str = "all-MiniLM-L6-v2") -> SentenceTransformer:
    """Lazy load and cache the SentenceTransformer embedding model."""
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is None:
        try:
            # Try offline local cache first for fast startup
            _EMBEDDING_MODEL = SentenceTransformer(model_name, local_files_only=True)
        except Exception:
            _EMBEDDING_MODEL = SentenceTransformer(model_name)
    return _EMBEDDING_MODEL


class KnowledgeIndexer:
    """Manages indexing, ChromaDB persistence, BM25 indexing, and version promotion."""

    def __init__(
        self,
        persist_directory: str | Path = "./storage/chroma_db",
        collection_name: str = "technova_knowledge_base",
        embedding_model_name: str = "all-MiniLM-L6-v2",
    ):
        self.persist_directory = str(Path(persist_directory).resolve())
        os.makedirs(self.persist_directory, exist_ok=True)

        # Initialize ChromaDB persistent client
        self.chroma_client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection = self.chroma_client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

        self.model_name = embedding_model_name

    def index_chunks(self, chunks: List[Chunk]) -> int:
        """Embed and insert a batch of chunks into ChromaDB."""
        if not chunks:
            return 0

        model = get_embedding_model(self.model_name)

        ids: List[str] = []
        documents: List[str] = []
        metadatas: List[dict] = []

        for chunk in chunks:
            ids.append(chunk.metadata.chunk_id)
            documents.append(chunk.text)
            metadatas.append(chunk.metadata.to_chroma_dict())

        # Generate dense embeddings
        embeddings = model.encode(documents, show_progress_bar=False).tolist()

        # Upsert into ChromaDB collection
        self.collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        return len(chunks)

    def set_previous_versions_inactive(self, document_id: str, active_version_id: str) -> int:
        """Mark previous versions of a document as inactive (is_active=False) in ChromaDB."""
        results = self.collection.get(
            where={"document_id": document_id},
            include=["metadatas"],
        )

        if not results or not results["ids"]:
            return 0

        updated_count = 0
        for chunk_id, metadata in zip(results["ids"], results["metadatas"]):
            if metadata.get("version_id") != active_version_id and metadata.get("is_active"):
                metadata["is_active"] = False
                metadata["status"] = "archived"
                self.collection.update(
                    ids=[chunk_id],
                    metadatas=[metadata],
                )
                updated_count += 1

        return updated_count

    def build_bm25_corpus(self) -> tuple[BM25Okapi, List[str], List[dict]]:
        """Retrieve all active chunks from ChromaDB and construct an in-memory BM25 index."""
        results = self.collection.get(include=["documents", "metadatas"])
        
        documents = results["documents"] or []
        metadatas = results["metadatas"] or []

        # Tokenize documents for BM25
        tokenized_corpus = [doc.lower().split() for doc in documents]
        bm25_index = BM25Okapi(tokenized_corpus) if tokenized_corpus else None

        return bm25_index, documents, metadatas

    def search(
        self,
        query: str,
        top_k: int = 5,
        category: Optional[str] = None,
        only_active: bool = True,
        user_role: Optional[str] = None,
        user_department: Optional[str] = None,
    ) -> List[dict]:
        """Perform semantic vector search against stored document chunks in ChromaDB.

        Allows filtering by active status, category, and RBAC user permissions.
        """
        model = get_embedding_model(self.model_name)
        query_embedding = model.encode([query], show_progress_bar=False).tolist()

        where_clauses = []
        if only_active:
            where_clauses.append({"is_active": True})
        if category:
            where_clauses.append({"category": category.upper()})

        if len(where_clauses) > 1:
            where_filter = {"$and": where_clauses}
        elif len(where_clauses) == 1:
            where_filter = where_clauses[0]
        else:
            where_filter = None

        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=top_k * 2 if (user_role or user_department) else top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        matches = []
        if results and results["documents"] and results["documents"][0]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                # RBAC filter checks
                if user_role:
                    allowed_roles = [r.strip().lower() for r in meta.get("allowed_roles", "").split(",") if r.strip()]
                    if allowed_roles and user_role.lower() not in allowed_roles:
                        continue
                if user_department:
                    allowed_depts = [d.strip().lower() for d in meta.get("allowed_departments", "").split(",") if d.strip()]
                    if allowed_depts and "all" not in allowed_depts and user_department.lower() not in allowed_depts:
                        continue

                similarity_score = round(max(0.0, 1.0 - float(dist)), 4)
                matches.append({
                    "text": doc,
                    "metadata": meta,
                    "distance": float(dist),
                    "score": similarity_score,
                })
                if len(matches) >= top_k:
                    break

        return matches

