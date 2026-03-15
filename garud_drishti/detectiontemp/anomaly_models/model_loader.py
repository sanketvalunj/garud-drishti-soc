from .pyod_model import PyODModel


class ModelLoader:
    """
    Selects anomaly model from config.
    """

    def __init__(self, model_name="isolation_forest"):
        self.model_name = model_name

    def load(self):
        if self.model_name == "isolation_forest":
            return PyODModel()
        raise ValueError(f"Unknown model: {self.model_name}")