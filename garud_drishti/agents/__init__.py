"""
Garud-Drishti SOC Agents

This package defines the multi-agent orchestration layer:
- CorrelationAgent      -> builds incidents from events
- InvestigationAgent    -> interprets and enriches incidents
- ResponseAgent         -> generates playbooks and workflows
- SOCMasterAgent        -> orchestrates the full pipeline
"""

from .correlation_agent import CorrelationAgent
from .investigation_agent import InvestigationAgent
from .response_agent import ResponseAgent
from .soc_master_agent import SOCMasterAgent

__all__ = [
    "CorrelationAgent",
    "InvestigationAgent",
    "ResponseAgent",
    "SOCMasterAgent",
]