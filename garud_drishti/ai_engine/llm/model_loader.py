import shutil
from typing import Optional

from .ollama_client import OllamaClient


class ModelLoader:
    """
    Responsible for selecting and loading the local LLM backend.

    Supports:
    - Ollama models (preferred offline inference)
    - Future HuggingFace local models
    """

    def __init__(
        self,
        provider: str = "ollama",
        model_name: str = "llama3"
    ):
        self.provider = provider
        self.model_name = model_name
        self.client: Optional[OllamaClient] = None

    # --------------------------------------------------
    # CHECK OLLAMA INSTALLED
    # --------------------------------------------------
    def _ollama_available(self) -> bool:
        return shutil.which("ollama") is not None

    # --------------------------------------------------
    # LOAD MODEL
    # --------------------------------------------------
    def load(self):
        """
        Initialize model client.
        """

        if self.provider == "ollama":
            if not self._ollama_available():
                raise RuntimeError(
                    "Ollama not found. Install it to run local LLM."
                )

            self.client = OllamaClient(model=self.model_name)
            return self.client

        # Future: HF support placeholder
        elif self.provider == "hf":
            raise NotImplementedError(
                "HuggingFace local model loading not implemented yet."
            )

        else:
            raise ValueError(f"Unknown model provider: {self.provider}")

    # --------------------------------------------------
    # GENERATE TEXT
    # --------------------------------------------------
    def generate(self, prompt: str) -> str:
        """
        Unified interface for LLM inference.
        """

        if not self.client:
            self.load()

        return self.client.generate(prompt)