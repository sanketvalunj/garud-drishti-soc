"""
Playbook Engine Package

Handles:
- Playbook generation via LLM
- Workflow structuring
- Automated response selection

This package exposes the main classes used by the SOC AI engine.
"""

from .generator import PlaybookGenerator
from .workflow_builder import WorkflowBuilder
from .response_selector import ResponseSelector

__all__ = [
    "PlaybookGenerator",
    "WorkflowBuilder",
    "ResponseSelector",
]