"""Query and Question-Answering router with permission-aware RAG generation."""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user, get_current_user_context
from src.database.models import AuditLog, User
from src.database.session import get_db
from src.rag.engine import EnterpriseRAGEngine
from src.rag.schemas import RAGQuery, RAGResponse
from src.retrieval.engine import SecureHybridRetrievalEngine
from src.retrieval.schemas import RetrievalQuery, RetrievalResponse, UserContext

router = APIRouter(prefix="/query", tags=["Knowledge Assistant"])

# Lazy-loaded engine instances to ensure lightning-fast server startup
_retrieval_engine = None
_rag_engine = None


def get_retrieval_engine() -> SecureHybridRetrievalEngine:
    global _retrieval_engine
    if _retrieval_engine is None:
        _retrieval_engine = SecureHybridRetrievalEngine()
    return _retrieval_engine


def get_rag_engine() -> EnterpriseRAGEngine:
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = EnterpriseRAGEngine(retrieval_engine=get_retrieval_engine())
    return _rag_engine


@router.post("/ask", response_model=RAGResponse)
def ask_question(
    payload: RAGQuery,
    user: UserContext = Depends(get_current_user_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ask a question based strictly on authorized enterprise knowledge with citations."""
    engine = get_rag_engine()
    response = engine.ask(query=payload, user=user)

    # Record query audit log
    audit = AuditLog(
        user_id=current_user.id,
        username=current_user.username,
        action="QUERY_RAG_ASK",
        resource=payload.query[:500],
        outcome="SUCCESS" if response.grounded else "REFUSED",
        details=f"Retrieved {len(response.citations)} citations. Latency: {response.latency_ms}ms",
    )
    db.add(audit)
    db.commit()

    return response


@router.post("/stream")
def stream_question(
    payload: RAGQuery,
    user: UserContext = Depends(get_current_user_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream response tokens in real-time for interactive web chat."""
    audit = AuditLog(
        user_id=current_user.id,
        username=current_user.username,
        action="QUERY_RAG_STREAM",
        resource=payload.query[:500],
        outcome="SUCCESS",
        details="Streaming token generation initiated",
    )
    db.add(audit)
    db.commit()

    engine = get_rag_engine()
    return StreamingResponse(
        engine.stream_ask(query=payload, user=user),
        media_type="text/plain",
    )


@router.post("/search", response_model=RetrievalResponse)
def search_knowledge(
    payload: RetrievalQuery,
    user: UserContext = Depends(get_current_user_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Perform secure hybrid retrieval (dense + sparse + rerank) without LLM synthesis."""
    engine = get_retrieval_engine()
    response = engine.retrieve(query=payload, user=user)

    audit = AuditLog(
        user_id=current_user.id,
        username=current_user.username,
        action="QUERY_SEARCH",
        resource=payload.query[:500],
        outcome="SUCCESS",
        details=f"Returned {len(response.chunks)} chunks. Pre-filter candidates: {response.audit_metadata.get('pre_filter_authorized_count')}",
    )
    db.add(audit)
    db.commit()

    return response
