"""Cross-Encoder Reranking engine for high-precision passage relevance evaluation."""

import logging
from typing import List, Optional
from sentence_transformers import CrossEncoder
from src.retrieval.schemas import RetrievedChunk

logger = logging.getLogger("technova.reranker")

_CROSS_ENCODER_MODEL: Optional[CrossEncoder] = None


def get_cross_encoder_model(
    model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
) -> Optional[CrossEncoder]:
    """Lazy load and cache the CrossEncoder reranker model."""
    global _CROSS_ENCODER_MODEL
    if _CROSS_ENCODER_MODEL is None:
        try:
            # Try offline local cache first to avoid huggingface network timeouts
            _CROSS_ENCODER_MODEL = CrossEncoder(model_name, local_files_only=True)
        except Exception:
            try:
                _CROSS_ENCODER_MODEL = CrossEncoder(model_name)
            except Exception as e:
                logger.warning(
                    "Could not initialize CrossEncoder model '%s': %s. Falling back to hybrid RRF scores.",
                    model_name,
                    e,
                )
                return None
    return _CROSS_ENCODER_MODEL


class CrossEncoderReranker:
    """Reranks candidate chunks using a deep cross-attention transformer."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model_name = model_name

    def rerank(
        self,
        query: str,
        candidates: List[RetrievedChunk],
        top_k: int = 5,
    ) -> List[RetrievedChunk]:
        """Score (query, chunk_text) pairs and return top_k reranked chunks.
        
        If CrossEncoder model is unavailable (e.g. offline cold-start), candidates
        are ranked by their fused RRF score.
        """
        if not candidates:
            return []

        model = get_cross_encoder_model(self.model_name)

        if model is None:
            # Fallback to RRF rank
            candidates.sort(key=lambda c: c.rrf_score, reverse=True)
            return candidates[:top_k]

        # Prepare (query, passage) pairs
        pairs = [(query, c.text) for c in candidates]

        try:
            # Predict cross-encoder relevance scores
            scores = model.predict(pairs, show_progress_bar=False)

            # Assign scores
            for chunk, score in zip(candidates, scores):
                chunk.rerank_score = float(score)

            # Sort descending by cross-encoder score
            candidates.sort(key=lambda c: c.rerank_score, reverse=True)
        except Exception as err:
            logger.warning("Reranking failed with error: %s. Using RRF ranking.", err)
            candidates.sort(key=lambda c: c.rrf_score, reverse=True)

        return candidates[:top_k]
