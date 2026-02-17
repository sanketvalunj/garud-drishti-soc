"""
Configuration loader for Garud Drishti SOC.
Loads YAML configuration files from the config directory.
"""
import os
import yaml
from pathlib import Path
from typing import Any, Dict, Optional


class Config:
    """Singleton configuration class that loads all config files."""
    
    _instance: Optional['Config'] = None
    _system: Dict[str, Any] = {}
    _response: Dict[str, Any] = {}
    _model: Dict[str, Any] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_configs()
        return cls._instance
    
    def _load_configs(self):
        """Load all configuration files."""
        # Get the config directory - assume it's relative to the project root
        config_dir = Path(__file__).parent.parent.parent.parent / "config"
        
        if not config_dir.exists():
            config_dir = Path(__file__).parent.parent.parent / "config"
        
        # Load system config
        system_config_path = config_dir / "system_config.yaml"
        if system_config_path.exists():
            with open(system_config_path, 'r') as f:
                self._system = yaml.safe_load(f) or {}
        
        # Load response rules
        response_config_path = config_dir / "response_rules.yaml"
        if response_config_path.exists():
            with open(response_config_path, 'r') as f:
                self._response = yaml.safe_load(f) or {}
        
        # Load model config
        model_config_path = config_dir / "model_config.yaml"
        if model_config_path.exists():
            with open(model_config_path, 'r') as f:
                self._model = yaml.safe_load(f) or {}
    
    @property
    def system(self) -> Dict[str, Any]:
        """Get system configuration."""
        return self._system
    
    @property
    def response(self) -> Dict[str, Any]:
        """Get response rules configuration."""
        return self._response
    
    @property
    def model(self) -> Dict[str, Any]:
        """Get model configuration."""
        return self._model
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get a configuration value from system config."""
        return self._system.get(key, default)

