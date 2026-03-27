import logging
from apscheduler.schedulers.background import BackgroundScheduler
from tzlocal import get_localzone

logger = logging.getLogger("garud_drishti.scheduler")

def start_scheduler():
    """Initializes and starts the background task scheduler."""
    try:
        scheduler = BackgroundScheduler(timezone=str(get_localzone()))
        # Add tasks here if needed in the future
        # Example: scheduler.add_job(run_ueba_analysis, 'interval', minutes=30)
        scheduler.start()
        logger.info("✅ Background scheduler started successfully")
    except Exception as e:
        logger.error(f"❌ Failed to start background scheduler: {e}")
