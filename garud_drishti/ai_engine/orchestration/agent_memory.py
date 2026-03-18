class AgentMemory:
    """
    Shared memory between AI agents.
    Stores intermediate reasoning results.
    """
    def __init__(self):
        self.memory = {}

    def store(self, key: str, value: dict):
        self.memory[key] = value

    def retrieve(self, key: str):
        return self.memory.get(key)

    def dump(self):
        return self.memory
