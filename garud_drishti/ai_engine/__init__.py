"""
Garud-Drishti AI Engine

This package contains the intelligence layer of the SOC system.

Submodules:
- reasoning  -> incident understanding, MITRE mapping, risk explanation
- playbook   -> response generation, workflow building, automation selection
- llm        -> local model loading and inference via Ollama or transformers

The classes exposed here represent the public API of the AI engine.
"""

# --- Reasoning Layer ---
from .reasoning import (
    IncidentInterpreter,
    MitreMapper,
    RiskExplainer,
)

# --- Playbook Layer ---
from .playbook import (
    PlaybookGenerator,
    WorkflowBuilder,
    ResponseSelector,
)

# Optional: expose LLM client if other modules need direct access
try:
    from .llm.ollama_client import OllamaClient
except Exception:  # keep import safe if LLM not installed yet
    OllamaClient = None


__all__ = [
    # reasoning
    "IncidentInterpreter",
    "MitreMapper",
    "RiskExplainer",

    # playbook
    "PlaybookGenerator",
    "WorkflowBuilder",
    "ResponseSelector",

    # llm
    "OllamaClient",
]