from typing import Optional

from .ollama_client import OllamaClient


class ModelLoader:
    """
    Responsible for selecting and loading the local LLM backend.

    Supports:
    - Ollama models (preferred offline inference) ONLY
    """

    def __init__(
        self,
        provider: str = "ollama",
        model_name: str = "mistral"
    ):
        if provider != "ollama":
            raise ValueError("Only Ollama is supported in this offline SOC pipeline.")
        self.provider = provider
        self.model_name = model_name
        self.client: Optional[OllamaClient] = None

    # --------------------------------------------------
    # LOAD MODEL
    # --------------------------------------------------
    def load(self):
        """
        Initialize model client.
        """
        self.client = OllamaClient(model=self.model_name)
        return self.client

    # --------------------------------------------------
    # GENERATE TEXT
    # --------------------------------------------------
    def generate(self, prompt: str) -> str:
        """
        Unified interface for LLM inference.
        """
        if not self.client:
            self.load()

        if self.client:
            return self.client.generate(prompt)
        return ""