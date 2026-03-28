import os
import requests
import time
import socket
from typing import Optional, Dict, Any


# ---------------- CONFIG ----------------
OLLAMA_URL = os.getenv("OLLAMA_GENERATE_URL", "http://localhost:11434/api/generate")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
# Fail fast when Ollama isn't reachable; allow long enough read for large JSON playbooks on CPU.
CONNECT_TIMEOUT_S = float(os.getenv("OLLAMA_CONNECT_TIMEOUT", "2"))
READ_TIMEOUT_S = float(os.getenv("OLLAMA_READ_TIMEOUT", "180"))
MAX_RETRIES = int(os.getenv("OLLAMA_RETRIES", "0"))


# ---------------- INTERNAL CALL ----------------
def _call_ollama(
    prompt: str,
    model: str,
    temperature: float,
    timeout: Any,
) -> str:
    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature
        }
    }

    response = requests.post(
        OLLAMA_URL,
        json=payload,
        timeout=timeout
    )

    response.raise_for_status()
    data = response.json()

    return data.get("response", "").strip()


# ---------------- SAFE PUBLIC FUNCTION ----------------
def run_local_llm(
    prompt: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
    retries: int = MAX_RETRIES
) -> str:
    def _ollama_reachable() -> bool:
        # Quick TCP connect to avoid long HTTP timeouts.
        try:
            with socket.create_connection(("localhost", 11434), timeout=CONNECT_TIMEOUT_S):
                return True
        except Exception:
            return False

    if not _ollama_reachable():
        return (
            "LLM unavailable (Ollama endpoint not reachable). "
            "Recommend manual investigation, log review, containment, and SOC escalation."
        )

    last_error: Optional[Exception] = None

    for attempt in range(retries + 1):
        try:
            result = _call_ollama(
                prompt=prompt,
                model=model,
                temperature=temperature,
                timeout=(CONNECT_TIMEOUT_S, READ_TIMEOUT_S),
            )

            if result:
                return result

            raise RuntimeError("Empty LLM response")

        except Exception as e:
            last_error = e
            # Avoid long sleeps; we already fail fast on connectivity.
            time.sleep(0.2)

    # SAFE FALLBACK (never crash pipeline)
    return (
        "LLM unavailable after retry. Recommend manual investigation, log review, containment, and SOC escalation."
    )


# ---------------- CLASS WRAPPER ----------------
class OllamaClient:
    """
    Persistent client wrapper for backend or agents.
    """

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        temperature: float = 0.2
    ):
        self.model = model
        self.temperature = temperature

    def generate(self, prompt: str) -> str:
        return run_local_llm(
            prompt=prompt,
            model=self.model,
            temperature=self.temperature
        )