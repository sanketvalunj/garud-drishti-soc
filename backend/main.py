"""
Garud-Drishti SOC — Main Application Entry Point
===================================================
FastAPI application that orchestrates:
  1. Enterprise environment simulation (50 employees, servers, DBs)
  2. Security telemetry generation (10,000+ logs)
  3. MITRE ATT&CK enrichment + security context enrichment
  4. Elasticsearch indexing (with in-memory fallback)
  5. Real-time log streaming via background task
  6. REST API for event queries and attack simulation

Usage:
  cd c:\\cryptix
  python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ─────────────────────────────────────────────
# Ensure project root is on sys.path
# ─────────────────────────────────────────────
PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# ─────────────────────────────────────────────
# Internal imports (updated for refactored modules)
# ─────────────────────────────────────────────
from simulator.enterprise_simulator import (
    EnterpriseEnvironment, get_enterprise_env, reset_enterprise_env,
)
from simulator.log_generator import LogGenerator
from simulator.attack_scenarios import (
    AttackScenarioGenerator, get_attack_generator,
)

from backend.ingestion.log_parser import LogParser
from backend.ingestion.schema_mapper import SchemaMapper
from backend.ingestion.normalize_logs import LogNormalizer

from backend.services.elastic_client import ElasticClient
from backend.services.index_events import EventIndexer

from backend.threat_intel.mitre_mapping import enrich_event_mitre
from backend.enrichment.security_context import enrich_event as enrich_context

from backend.api.events_api import router as events_router, set_indexer
from backend.api.simulate_api import router as simulate_router, set_dependencies

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("garud_drishti")


# ─────────────────────────────────────────────
# GLOBAL INSTANCES
# ─────────────────────────────────────────────
enterprise: EnterpriseEnvironment = None
generator: LogGenerator = None
attack_engine: AttackScenarioGenerator = None
parser: LogParser = None
mapper: SchemaMapper = None
normalizer: LogNormalizer = None
es_client: ElasticClient = None
indexer: EventIndexer = None

# Streaming control
streaming_active = False
streaming_task = None


# ─────────────────────────────────────────────
# STARTUP / SHUTDOWN
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown."""
    global enterprise, generator, attack_engine
    global parser, mapper, normalizer
    global es_client, indexer
    global streaming_active, streaming_task

    start_time = time.time()
    logger.info("=" * 60)
    logger.info("🦅 GARUD-DRISHTI AI SOC PLATFORM — STARTING UP")
    logger.info("=" * 60)

    # ── Phase 1: Enterprise Simulation ──
    logger.info("🏢 Phase 1: Building enterprise environment...")
    enterprise = get_enterprise_env(50)
    summary = enterprise.summary()
    logger.info(f"   ✅ {summary['employees']} employees")
    logger.info(f"   ✅ {summary['servers']} servers")
    logger.info(f"   ✅ {summary['databases']} databases")
    logger.info(f"   ✅ {summary['devices']} devices")
    logger.info(f"   ✅ {summary['segments']} network segments")

    # ── Phase 2: Initialize Components ──
    logger.info("🔧 Phase 2: Initializing pipeline components...")
    generator = LogGenerator()
    attack_engine = get_attack_generator()
    parser = LogParser()
    mapper = SchemaMapper()
    normalizer = LogNormalizer()

    # ── Phase 3: Elasticsearch ──
    logger.info("🔍 Phase 3: Connecting to Elasticsearch...")
    es_client = ElasticClient()
    indexer = EventIndexer(es_client)

    if es_client.is_enabled():
        indexer.create_index()
        logger.info("   ✅ Elasticsearch connected and index ready")
    else:
        logger.warning("   ⚠ Elasticsearch unavailable — using in-memory storage")

    # ── Phase 4: Generate & Index Logs ──
    logger.info("📊 Phase 4: Generating 10,000+ security logs...")
    events = generator.generate_batch(count=10500)
    logger.info(f"   ✅ Generated {len(events)} enriched events")

    # Save raw logs to files
    data_dir = os.path.join(PROJECT_ROOT, "data", "raw_logs")
    save_result = generator.generate_to_file(output_dir=data_dir, count=500)
    logger.info(f"   💾 Raw log files saved: {save_result}")

    # Index events
    logger.info("🔄 Phase 5: Indexing events...")
    index_result = indexer.index_events(events)
    logger.info(f"   ✅ Indexed {index_result.get('indexed', 0)} events ({index_result.get('storage', 'unknown')})")

    # ── Phase 5: Wire up API dependencies ──
    set_indexer(indexer)
    set_dependencies(attack_engine, indexer, mapper)

    # ── Phase 6: Start streaming ──
    logger.info("📡 Phase 6: Starting real-time log stream...")
    streaming_active = True
    streaming_task = asyncio.create_task(_stream_logs())

    elapsed = time.time() - start_time
    logger.info("=" * 60)
    logger.info(f"🚀 GARUD-DRISHTI SOC READY — {elapsed:.1f}s startup")
    logger.info(f"   📊 {len(events)} events loaded")
    logger.info(f"   🔍 ES: {'connected' if es_client.is_enabled() else 'offline (file mode)'}")
    logger.info(f"   📡 Real-time streaming: active")
    logger.info(f"   🌐 API: http://localhost:8000/docs")
    logger.info("=" * 60)

    yield  # Application runs

    # ── Shutdown ──
    logger.info("🛑 Shutting down Garud-Drishti SOC...")
    streaming_active = False
    if streaming_task:
        streaming_task.cancel()
        try:
            await streaming_task
        except asyncio.CancelledError:
            pass
    logger.info("👋 Shutdown complete")


# ─────────────────────────────────────────────
# REAL-TIME STREAMING TASK
# ─────────────────────────────────────────────

async def _stream_logs():
    """Background task that generates one enriched log every 0.3-0.7 seconds."""
    global streaming_active
    import random

    logger.info("📡 Real-time log stream started")
    stream_iter = generator.stream()

    while streaming_active:
        try:
            # Generate one enriched event from the infinite stream
            event = next(stream_iter)

            # Index into storage
            indexer.index_single(event)

            # Variable delay (0.3 to 0.7 seconds)
            delay = random.uniform(0.3, 0.7)
            await asyncio.sleep(delay)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            await asyncio.sleep(1)

    logger.info("📡 Real-time log stream stopped")


# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────

app = FastAPI(
    title="Garud-Drishti AI SOC Platform",
    description=(
        "AI-powered Security Operations Center telemetry ingestion platform "
        "for banking environments. Simulates enterprise security events, "
        "enriches with MITRE ATT&CK mappings and threat intelligence, "
        "normalizes logs, stores in Elasticsearch, and provides query APIs."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REGISTER ROUTERS ──
app.include_router(events_router)
app.include_router(simulate_router)


# ─────────────────────────────────────────────
# ROOT ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/", tags=["System"])
def root():
    """Health check and system info."""
    return {
        "system": "Garud-Drishti AI SOC Platform",
        "status": "running",
        "version": "1.0.0",
        "elasticsearch": es_client.is_enabled() if es_client else False,
        "streaming": streaming_active,
        "events_cached": indexer.cached_event_count if indexer else 0,
        "docs": "/docs",
    }


@app.get("/health", tags=["System"])
def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "components": {
            "enterprise_sim": enterprise is not None,
            "log_generator": generator is not None,
            "attack_engine": attack_engine is not None,
            "parser": parser is not None,
            "schema_mapper": mapper is not None,
            "elasticsearch": es_client.is_enabled() if es_client else False,
            "event_indexer": indexer is not None,
            "streaming": streaming_active,
            "mitre_mapping": True,
            "security_context": True,
        },
        "event_stats": indexer.get_event_stats() if indexer else {},
    }


@app.get("/enterprise", tags=["System"])
def enterprise_info():
    """Get enterprise environment summary."""
    if enterprise is None:
        return {"error": "Enterprise not initialized"}
    return enterprise.summary()


@app.get("/stream/status", tags=["Streaming"])
def stream_status():
    """Get real-time streaming status."""
    return {
        "streaming": streaming_active,
        "events_in_cache": indexer.cached_event_count if indexer else 0,
    }


@app.post("/stream/toggle", tags=["Streaming"])
async def toggle_stream():
    """Toggle real-time streaming on/off."""
    global streaming_active, streaming_task

    if streaming_active:
        streaming_active = False
        if streaming_task:
            streaming_task.cancel()
        return {"streaming": False, "message": "Streaming stopped"}
    else:
        streaming_active = True
        streaming_task = asyncio.create_task(_stream_logs())
        return {"streaming": True, "message": "Streaming started"}
