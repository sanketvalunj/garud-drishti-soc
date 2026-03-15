import sys
from pathlib import Path

# Provide the correct path for imports
sys.path.append(str(Path(__file__).resolve().parent.parent))

from garud_drishti.agents.soc_master_agent import SOCMasterAgent

def main():
    soc = SOCMasterAgent()
    soc.run()

if __name__ == "__main__":
    main()