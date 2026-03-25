
#!/bin/bash
source venv/bin/activate
python -m uvicorn garud_drishti.backend.main:app --reload
//start server with= ./run.sh