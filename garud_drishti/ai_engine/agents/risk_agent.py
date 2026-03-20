import json
from garud_drishti.ai_engine.llm.ollama_client import OllamaClient
from pathlib import Path


class RiskAgent:
    def __init__(self):
        self.llm = OllamaClient(model="mistral")

    def analyze(self, incident, attack_chain=None, risk_factors=None):
        template_path = Path(__file__).resolve().parent.parent / "llm" / "prompt_templates" / "incident_analysis.txt"
        
        try:
            template = template_path.read_text()
            prompt = template\
                .replace("{incident_data}", json.dumps(incident, indent=2))\
                .replace("{attack_chain}", json.dumps(attack_chain or {}, indent=2))\
                .replace("{risk_factors}", json.dumps(risk_factors or {}, indent=2))
        except FileNotFoundError:
            prompt = f"Analyze incident: {json.dumps(incident, indent=2)}\nAttack Chain: {attack_chain}\nRisk Factors: {risk_factors}"

        try:
            response = self.llm.generate(prompt)
            # Try to parse json safely. Sometimes llm wraps in ```json ... ```
            text = response.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text)
        except Exception as e:
            # Fallback if parsing fails or LLM is offline
            return {
                "risk_score": 8,
                "severity": "high",
                "confidence": 80
            }
