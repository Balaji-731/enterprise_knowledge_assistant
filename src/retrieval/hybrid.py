"""Hybrid Fusion algorithm combining Dense Vector Search and BM25 Sparse Search.

Uses Reciprocal Rank Fusion (RRF) to blend semantic understanding with exact
keyword/code matching without requiring manual score scale normalization.
"""

from collections import defaultdict
from typing import Dict, List, Tuple


def reciprocal_rank_fusion(
    dense_ranked_ids: List[str],
    sparse_ranked_ids: List[str],
    k: int = 60,
) -> List[Tuple[str, float]]:
    """Compute Reciprocal Rank Fusion scores across dense and sparse ranking lists.
    
    Formula:
        RRF_score(chunk) = SUM(1 / (k + rank_i))
    
    Args:
        dense_ranked_ids: Ordered list of chunk_ids from vector search (highest similarity first).
        sparse_ranked_ids: Ordered list of chunk_ids from BM25 keyword search (highest score first).
        k: Smoothing constant to balance high-ranked and lower-ranked items (standard: 60).
        
    Returns:
        List of (chunk_id, rrf_score) sorted in descending order of fused relevance.
    """
    rrf_scores: Dict[str, float] = defaultdict(float)

    # Accumulate dense ranks (1-indexed)
    for rank, chunk_id in enumerate(dense_ranked_ids, start=1):
        rrf_scores[chunk_id] += 1.0 / (k + rank)

    # Accumulate sparse ranks (1-indexed)
    for rank, chunk_id in enumerate(sparse_ranked_ids, start=1):
        rrf_scores[chunk_id] += 1.0 / (k + rank)

    # Sort candidates by combined RRF score descending
    sorted_candidates = sorted(
        rrf_scores.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    return sorted_candidates
