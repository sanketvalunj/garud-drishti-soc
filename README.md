🛡️ Garud-Drishti SOC AI Platform

Garud-Drishti is an autonomous, fully offline AI-powered cyber incident response platform designed for banking environments.
It ingests security alerts, detects anomalies, correlates events across systems, and generates context-aware response playbooks — all within a secure local infrastructure.

🚀 Problem It Solves

Banks receive thousands of security alerts daily from multiple tools such as SIEM and EDR systems.
Traditional SOC workflows:

generate alert fatigue

require manual investigation

respond slowly to threats

fail to correlate multi-step attacks

Garud-Drishti addresses this by acting as an AI SOC assistant that understands, prioritizes, and responds to incidents automatically.

🧠 Key Features

✔ Fully offline architecture — no external data transfer
✔ SIEM + EDR alert ingestion
✔ Behavioral anomaly detection (UEBA)
✔ Cross-system incident correlation
✔ Cognitive incident graph creation
✔ Local LLM-based reasoning engine
✔ Auto-generated incident response playbooks
✔ Fidelity-based alert prioritization
✔ Modular reusable SOC architecture

🏗️ System Architecture

The platform consists of six core layers:

Data Sources (SIEM, EDR, authentication logs)

Ingestion & Normalization Engine

Detection & Behavioral Analytics Engine

Incident Graph & Correlation Engine

AI Reasoning & Playbook Generator

Storage, Backend & Analyst Dashboard

All components run within a secure offline banking network.

📂 Project Structure
garud-drishti-soc/
├── garud_drishti/
│   ├── ingestion/
│   ├── detection/
│   ├── correlation/
│   ├── ai_engine/
│   ├── backend/
│   ├── storage/
│   ├── automation/
│   └── agents/
├── config/
├── data/
├── models/
├── dashboard/
├── scripts/
├── tests/
├── requirements.txt
└── README.md

🔐 Security Design

Fully offline execution

Local LLM inference via Ollama

No external APIs

Encrypted storage support

Role-based access control ready

Air-gap deployment compatible

🧩 Tech Stack

Python + FastAPI backend

Elasticsearch for log storage

PyOD + tsfresh for anomaly detection

LangChain / LangGraph for workflow orchestration

HuggingFace + Ollama for local LLM inference

Web dashboard for SOC interaction

🎯 Future Enhancements

Real-time attack simulation engine

Self-learning SOC memory module

Predictive insider threat detection

Automated containment workflows

Multi-bank deployment framework

👨‍💻 Team

Developed as part of a cybersecurity AI system design project.
Platform name inspired by Garud Drishti — the mythological eagle vision representing vigilance and protection.

📜 License

For academic and research purposes.

Save → Ctrl+X, then Y.

