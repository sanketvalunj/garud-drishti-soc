import requests
import time
from typing import Optional, Dict, Any


# ---------------- CONFIG ----------------
OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "llama3"
DEFAULT_TIMEOUT = 120
MAX_RETRIES = 2


# ---------------- INTERNAL CALL ----------------
def _call_ollama(
    prompt: str,
    model: str,
    temperature: float,
    timeout: int
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
    last_error: Optional[Exception] = None

    for attempt in range(retries + 1):
        try:
            result = _call_ollama(
                prompt=prompt,
                model=model,
                temperature=temperature,
                timeout=DEFAULT_TIMEOUT
            )

            if result:
                return result

            raise RuntimeError("Empty LLM response")

        except Exception as e:
            last_error = e
            time.sleep(1.2)

    # SAFE FALLBACK (never crash pipeline)
    return (
        "LLM unavailable. Recommend manual investigation, "
        "log review, containment, and SOC escalation."
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