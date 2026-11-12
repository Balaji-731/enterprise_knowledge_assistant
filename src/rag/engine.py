"""Enterprise RAG Engine orchestrating Secure Retrieval and Grounded Generation."""

import re
import time
from typing import Generator, List, Optional
from src.rag.client import OllamaClient
from src.rag.prompts import build_grounded_prompt
from src.rag.schemas import CitationRecord, RAGQuery, RAGResponse
from src.retrieval.engine import SecureHybridRetrievalEngine
from src.retrieval.schemas import RetrievalQuery, UserContext


class EnterpriseRAGEngine:
    """Master RAG Engine combining permission-aware hybrid retrieval with local LLM generation."""

    def __init__(
        self,
        retrieval_engine: Optional[SecureHybridRetrievalEngine] = None,
        ollama_client: Optional[OllamaClient] = None,
        default_model: str = "llama3.2:latest",
    ):
        self.retrieval_engine = retrieval_engine or SecureHybridRetrievalEngine()
        self.ollama_client = ollama_client or OllamaClient()
        self.default_model = default_model

    def ask(
        self,
        query: str | RAGQuery,
        user: UserContext,
    ) -> RAGResponse:
        """Answer an employee's natural-language inquiry with grounded context and verified citations.
        
        Args:
            query: Either a question string or a structured RAGQuery.
            user: Authenticated UserContext (role, department, user_id).
            
        Returns:
            RAGResponse containing grounded answer and verified source citations.
        """
        start_time = time.perf_counter()

        if isinstance(query, str):
            rag_query = RAGQuery(query=query, model_name=self.default_model)
        else:
            rag_query = query

        search_text = rag_query.query.strip()
        if not search_text:
            return RAGResponse(
                query="",
                answer="Please provide a valid question.",
                citations=[],
                user_id=user.user_id,
                user_role=user.role.value,
                user_department=user.department,
                model_used=rag_query.model_name,
                latency_ms=0.0,
                grounded=False,
            )

        # -------------------------------------------------------------
        # STEP 1: Secure Hybrid Retrieval (Phase 5)
        # -------------------------------------------------------------
        retrieval_spec = RetrievalQuery(
            query=search_text,
            top_k=rag_query.top_k,
            include_historical=rag_query.include_historical,
        )
        retrieval_res = self.retrieval_engine.retrieve(
            query=retrieval_spec,
            user=user,
        )

        # Zero-leakage check: If user has 0 authorized chunks, refuse safely
        if not retrieval_res.chunks:
            duration = (time.perf_counter() - start_time) * 1000
            return RAGResponse(
                query=search_text,
                answer=(
                    "I cannot find this information in your authorized company documents. "
                    "Access may be restricted based on your role or department."
                ),
                citations=[],
                user_id=user.user_id,
                user_role=user.role.value,
                user_department=user.department,
                model_used=rag_query.model_name,
                latency_ms=round(duration, 2),
                grounded=False,
            )

        # -------------------------------------------------------------
        # STEP 2: Grounded Prompt Assembly
        # -------------------------------------------------------------
        system_prompt, user_prompt, citation_records = build_grounded_prompt(
            query=search_text,
            chunks=retrieval_res.chunks,
        )

        # -------------------------------------------------------------
        # STEP 3: LLM Generation via Ollama
        # -------------------------------------------------------------
        try:
            raw_answer = self.ollama_client.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                model=rag_query.model_name,
                temperature=rag_query.temperature,
            )
        except Exception as e:
            # Fallback if Ollama server is unreachable
            raw_answer = (
                f"Error communicating with local LLM ({rag_query.model_name}): {e}\n\n"
                "Retrieved Authorized Context was found but could not be summarized."
            )

        # -------------------------------------------------------------
        # STEP 4: Filter & Match In-Text Citations
        # -------------------------------------------------------------
        # Detect which [i] markers appear in the generated answer
        cited_indices = {
            int(match.group(1))
            for match in re.finditer(r"\[(\d+)\]", raw_answer)
        }

        # If model used inline citations [1], [2], keep only referenced ones;
        # otherwise provide all retrieved candidate sources for transparency
        if cited_indices:
            active_citations = [
                rec for rec in citation_records
                if rec.source_index in cited_indices
            ]
        else:
            active_citations = citation_records

        duration = (time.perf_counter() - start_time) * 1000

        # Check if the model stated it could not find info
        is_grounded = "cannot find this information" not in raw_answer.lower()

        return RAGResponse(
            query=search_text,
            answer=raw_answer,
            citations=active_citations,
            user_id=user.user_id,
            user_role=user.role.value,
            user_department=user.department,
            model_used=rag_query.model_name,
            latency_ms=round(duration, 2),
            grounded=is_grounded,
            raw_context=retrieval_res.authorized_context,
        )

    def stream_ask(
        self,
        query: str | RAGQuery,
        user: UserContext,
    ) -> Generator[str, None, None]:
        """Stream generated response tokens in real-time."""
        if isinstance(query, str):
            rag_query = RAGQuery(query=query, model_name=self.default_model)
        else:
            rag_query = query

        search_text = rag_query.query.strip()
        if not search_text:
            yield "Please provide a valid question."
            return

        retrieval_spec = RetrievalQuery(
            query=search_text,
            top_k=rag_query.top_k,
            include_historical=rag_query.include_historical,
        )
        retrieval_res = self.retrieval_engine.retrieve(query=retrieval_spec, user=user)

        if not retrieval_res.chunks:
            yield (
                "I cannot find this information in your authorized company documents. "
                "Access may be restricted based on your role or department."
            )
            return

        system_prompt, user_prompt, _ = build_grounded_prompt(
            query=search_text,
            chunks=retrieval_res.chunks,
        )

        for token in self.ollama_client.stream_generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=rag_query.model_name,
            temperature=rag_query.temperature,
        ):
            yield token
