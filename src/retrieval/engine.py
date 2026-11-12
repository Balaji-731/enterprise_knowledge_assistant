"""Master Secure Hybrid Retrieval Engine for TechNova Enterprise AI.

Implements the end-to-end authorized retrieval pipeline:
Query
  │
  ▼
[1. Pre-Retrieval Permission Filter] ──► Discards unauthorized chunks from search pool
  │
  ├──► [2. Dense Vector Search (ChromaDB + SentenceTransformers)]
  │
  └──► [3. Sparse Keyword Search (BM25)]
  │
  ▼
[4. Hybrid Fusion (Reciprocal Rank Fusion - RRF)]
  │
  ▼
[5. Cross-Encoder Reranking]
  │
  ▼
[6. Post-Retrieval Defense-in-Depth Verification] ──► Final sanity check against leakage
  │
  ▼
[7. Authorized Grounded Context & Verifiable Citations]
"""

import time
from pathlib import Path
from typing import Dict, List, Optional

import chromadb
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

from src.ingestion.indexer import get_embedding_model
from src.retrieval.hybrid import reciprocal_rank_fusion
from src.retrieval.permissions import (
    build_chroma_pre_filter,
    is_chunk_authorized,
    validate_defense_in_depth,
)
from src.retrieval.reranker import CrossEncoderReranker
from src.retrieval.schemas import (
    RetrievalQuery,
    RetrievalResponse,
    RetrievedChunk,
    UserContext,
)


class SecureHybridRetrievalEngine:
    """Enterprise-grade permission-aware hybrid search and reranking engine."""

    def __init__(
        self,
        persist_directory: str | Path = "./storage/chroma_db",
        collection_name: str = "technova_knowledge_base",
        embedding_model_name: str = "all-MiniLM-L6-v2",
        reranker_model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
    ):
        self.persist_directory = str(Path(persist_directory).resolve())
        self.chroma_client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection = self.chroma_client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self.embedding_model_name = embedding_model_name
        self.reranker = CrossEncoderReranker(model_name=reranker_model_name)

    def retrieve(
        self,
        query: str | RetrievalQuery,
        user: UserContext,
    ) -> RetrievalResponse:
        """Execute secure, permission-aware hybrid retrieval with reranking.
        
        Args:
            query: Either a query string or a structured RetrievalQuery object.
            user: Authenticated UserContext (role, department, user_id).
            
        Returns:
            RetrievalResponse containing authorized chunks, formatted context, and citations.
        """
        start_time = time.perf_counter()

        # Normalize query spec
        if isinstance(query, str):
            query_spec = RetrievalQuery(query=query)
        else:
            query_spec = query

        search_text = query_spec.query.strip()
        if not search_text:
            return RetrievalResponse(
                query="",
                user_id=user.user_id,
                user_role=user.role.value,
                user_department=user.department,
                chunks=[],
                total_candidates_found=0,
                authorized_context="",
                citations=[],
                audit_metadata={"duration_ms": 0, "status": "empty_query"},
            )

        # -------------------------------------------------------------
        # STEP 1: Pre-Retrieval Permission Filtering
        # -------------------------------------------------------------
        # 1a. Query-level metadata pre-filter for ChromaDB (e.g. is_active)
        chroma_where = build_chroma_pre_filter(user, query_spec)

        # 1b. Fetch all candidate metadata matching basic criteria
        raw_candidates = self.collection.get(
            where=chroma_where,
            include=["documents", "metadatas"],
        )

        candidate_ids = raw_candidates.get("ids", [])
        candidate_docs = raw_candidates.get("documents", [])
        candidate_metas = raw_candidates.get("metadatas", [])

        # Filter candidates strictly by user's effective RBAC/ABAC permissions
        authorized_chunk_dict: Dict[str, dict] = {}
        authorized_doc_map: Dict[str, str] = {}

        for c_id, doc_text, meta in zip(candidate_ids, candidate_docs, candidate_metas):
            if is_chunk_authorized(meta, user, include_historical=query_spec.include_historical):
                authorized_chunk_dict[c_id] = meta
                authorized_doc_map[c_id] = doc_text

        pre_filter_count = len(authorized_chunk_dict)

        # If user is authorized to view 0 chunks, return immediately (zero leakage)
        if pre_filter_count == 0:
            duration = (time.perf_counter() - start_time) * 1000
            return RetrievalResponse(
                query=search_text,
                user_id=user.user_id,
                user_role=user.role.value,
                user_department=user.department,
                chunks=[],
                total_candidates_found=0,
                authorized_context="No authorized enterprise documents found for your role and department.",
                citations=[],
                audit_metadata={
                    "duration_ms": round(duration, 2),
                    "pre_filter_authorized_count": 0,
                    "post_filter_dropped": 0,
                },
            )

        # -------------------------------------------------------------
        # STEP 2: Dense Semantic Search (Vector Embedding)
        # -------------------------------------------------------------
        embedder = get_embedding_model(self.embedding_model_name)
        query_embedding = embedder.encode(search_text).tolist()

        # Fetch top dense matches
        dense_results = self.collection.query(
            query_embeddings=[query_embedding],
            where=chroma_where,
            n_results=min(30, len(candidate_ids)),
            include=["documents", "metadatas", "distances"],
        )

        dense_ranked_ids: List[str] = []
        dense_scores: Dict[str, float] = {}

        if dense_results and dense_results.get("ids") and dense_results["ids"][0]:
            retrieved_ids = dense_results["ids"][0]
            retrieved_dists = dense_results["distances"][0] if dense_results.get("distances") else []

            for idx, c_id in enumerate(retrieved_ids):
                # Ensure dense candidate is authorized
                if c_id in authorized_chunk_dict:
                    dense_ranked_ids.append(c_id)
                    # Convert cosine distance to similarity score
                    dist = retrieved_dists[idx] if idx < len(retrieved_dists) else 1.0
                    dense_scores[c_id] = max(0.0, 1.0 - dist)

        # -------------------------------------------------------------
        # STEP 3: Sparse Keyword Search (BM25)
        # -------------------------------------------------------------
        authorized_ids_list = list(authorized_chunk_dict.keys())
        tokenized_corpus = [
            authorized_doc_map[c_id].lower().split()
            for c_id in authorized_ids_list
        ]

        sparse_ranked_ids: List[str] = []
        sparse_scores: Dict[str, float] = {}

        if tokenized_corpus:
            bm25 = BM25Okapi(tokenized_corpus)
            tokenized_query = search_text.lower().split()
            raw_bm25_scores = bm25.get_scores(tokenized_query)

            # Pair candidate ID with BM25 score
            scored_sparse = [
                (authorized_ids_list[i], float(score))
                for i, score in enumerate(raw_bm25_scores)
                if score > 0.0
            ]
            scored_sparse.sort(key=lambda x: x[1], reverse=True)

            for c_id, score in scored_sparse:
                sparse_ranked_ids.append(c_id)
                sparse_scores[c_id] = score

        # -------------------------------------------------------------
        # STEP 4: Hybrid Fusion (Reciprocal Rank Fusion - RRF)
        # -------------------------------------------------------------
        fused_rankings = reciprocal_rank_fusion(
            dense_ranked_ids=dense_ranked_ids,
            sparse_ranked_ids=sparse_ranked_ids,
            k=60,
        )

        # Select top candidates for reranking (e.g. top 2 * top_k or 15)
        candidate_pool_size = max(query_spec.top_k * 2, 10)
        top_fused_candidates = fused_rankings[:candidate_pool_size]

        # Assemble intermediate RetrievedChunk objects
        candidate_chunks: List[RetrievedChunk] = []
        for c_id, rrf_score in top_fused_candidates:
            meta = authorized_chunk_dict[c_id]
            chunk_obj = RetrievedChunk(
                chunk_id=c_id,
                document_id=meta.get("document_id", ""),
                version_id=meta.get("version_id", ""),
                document_title=meta.get("document_title", ""),
                version_number=meta.get("version_number", "1.0"),
                category=meta.get("category", ""),
                page_number=int(meta.get("page_number", 1)),
                section_header=meta.get("section_header", ""),
                text=authorized_doc_map.get(c_id, ""),
                allowed_roles=meta.get("allowed_roles", ""),
                allowed_departments=meta.get("allowed_departments", ""),
                allowed_users=meta.get("allowed_users", ""),
                is_active=bool(meta.get("is_active", True)),
                dense_score=dense_scores.get(c_id, 0.0),
                sparse_score=sparse_scores.get(c_id, 0.0),
                rrf_score=rrf_score,
            )
            candidate_chunks.append(chunk_obj)

        # -------------------------------------------------------------
        # STEP 5: Cross-Encoder Reranking
        # -------------------------------------------------------------
        reranked_chunks = self.reranker.rerank(
            query=search_text,
            candidates=candidate_chunks,
            top_k=query_spec.top_k,
        )

        # -------------------------------------------------------------
        # STEP 6: Post-Retrieval Defense-in-Depth Validation
        # -------------------------------------------------------------
        final_authorized_chunks, post_filter_dropped = validate_defense_in_depth(
            chunks=reranked_chunks,
            user=user,
            include_historical=query_spec.include_historical,
        )

        # -------------------------------------------------------------
        # STEP 7: Format Grounded Context & Citations
        # -------------------------------------------------------------
        context_blocks: List[str] = []
        citations: List[str] = []

        for i, chunk in enumerate(final_authorized_chunks, start=1):
            citation = chunk.format_citation()
            citations.append(citation)
            context_blocks.append(f"--- [Source {i}: {citation}] ---\n{chunk.text}")

        authorized_context = "\n\n".join(context_blocks)
        duration = (time.perf_counter() - start_time) * 1000

        return RetrievalResponse(
            query=search_text,
            user_id=user.user_id,
            user_role=user.role.value,
            user_department=user.department,
            chunks=final_authorized_chunks,
            total_candidates_found=len(final_authorized_chunks),
            authorized_context=authorized_context,
            citations=citations,
            audit_metadata={
                "duration_ms": round(duration, 2),
                "pre_filter_authorized_count": pre_filter_count,
                "post_filter_dropped": post_filter_dropped,
                "dense_hits": len(dense_ranked_ids),
                "sparse_hits": len(sparse_ranked_ids),
            },
        )
