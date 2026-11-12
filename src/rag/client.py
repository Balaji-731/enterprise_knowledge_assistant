"""Local LLM Client for Ollama integrating with TechNova RAG pipeline."""

import json
import logging
import os
from typing import Generator, List, Optional
import httpx

logger = logging.getLogger("technova.ollama")

DEFAULT_OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")


class OllamaClient:
    """Client for local LLM inference via Ollama REST API."""

    def __init__(
        self,
        base_url: str = DEFAULT_OLLAMA_URL,
        timeout_seconds: float = 120.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds

    def is_available(self) -> bool:
        """Check if Ollama server is running and accessible."""
        try:
            with httpx.Client(timeout=2.0) as client:
                res = client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    def get_installed_models(self) -> List[str]:
        """Fetch list of models available in local Ollama instance."""
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.warning("Failed to fetch Ollama models: %s", e)
        return []

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: str = "llama3.2:latest",
        temperature: float = 0.1,
    ) -> str:
        """Send generation request to Ollama and return complete text response."""
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt or "",
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                )
                if response.status_code != 200:
                    raise RuntimeError(
                        f"Ollama error ({response.status_code}): {response.text}"
                    )
                data = response.json()
                return data.get("response", "").strip()

        except httpx.ConnectError:
            raise ConnectionError(
                f"Could not connect to Ollama at {self.base_url}. "
                "Ensure the Ollama application or service is running."
            )

    def stream_generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: str = "llama3.2:latest",
        temperature: float = 0.1,
    ) -> Generator[str, None, None]:
        """Stream generated response tokens from Ollama in real-time."""
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt or "",
            "stream": True,
            "options": {
                "temperature": temperature,
            },
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        raise RuntimeError(
                            f"Ollama streaming error ({response.status_code})"
                        )
                    for line in response.iter_lines():
                        if line:
                            data = json.loads(line)
                            token = data.get("response", "")
                            yield token
                            if data.get("done", False):
                                break

        except httpx.ConnectError:
            raise ConnectionError(
                f"Could not connect to Ollama at {self.base_url}. "
                "Ensure the Ollama application or service is running."
            )
