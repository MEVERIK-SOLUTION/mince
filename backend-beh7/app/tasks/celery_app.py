import os
from celery import Celery
from kombu import Queue
from datetime import timedelta

# Konfigurace Celery
celery_app = Celery(
    "coin_collection_tasks",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
    include=[
        "app.tasks.scheduled_tasks",
        "app.tasks.background_jobs"
    ]
)

# Konfigurace
celery_app.conf.update(
    # Časové zóny
    timezone="Europe/Prague",
    enable_utc=True,
    
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Task routing
    task_routes={
        "app.tasks.scheduled_tasks.scrape_auction_houses": {"queue": "scraping"},
        "app.tasks.scheduled_tasks.update_coin_prices": {"queue": "price_updates"},
        "app.tasks.scheduled_tasks.send_price_alerts": {"queue": "notifications"},
        "app.tasks.scheduled_tasks.cleanup_old_data": {"queue": "maintenance"},
        "app.tasks.background_jobs.process_coin_identification": {"queue": "ai_processing"},
        "app.tasks.background_jobs.generate_reports": {"queue": "reports"},
        "app.tasks.background_jobs.backup_user_data": {"queue": "backups"},
    },
    
    # Queues
    task_default_queue="default",
    task_queues=(
        Queue("default", routing_key="default"),
        Queue("scraping", routing_key="scraping"),
        Queue("price_updates", routing_key="price_updates"),
        Queue("notifications", routing_key="notifications"),
        Queue("maintenance", routing_key="maintenance"),
        Queue("ai_processing", routing_key="ai_processing"),
        Queue("reports", routing_key="reports"),
        Queue("backups", routing_key="backups"),
    ),
    
    # Worker konfigurace
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=1000,
    
    # Task execution
    task_soft_time_limit=300,  # 5 minut
    task_time_limit=600,       # 10 minut
    task_max_retries=3,
    task_default_retry_delay=60,
    
    # Results
    result_expires=3600,  # 1 hodina
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# Periodické úlohy (Celery Beat)
celery_app.conf.beat_schedule = {
    # Scraping aukčních domů - každé 2 hodiny
    "scrape-auction-houses": {
        "task": "app.tasks.scheduled_tasks.scrape_auction_houses",
        "schedule": timedelta(hours=2),
        "options": {"queue": "scraping"}
    },
    
    # Aktualizace cen mincí - každý den ve 3:00
    "update-coin-prices": {
        "task": "app.tasks.scheduled_tasks.update_coin_prices",
        "schedule": timedelta(hours=24),
        "options": {"queue": "price_updates"}
    },
    
    # Odesílání cenových alertů - každé 4 hodiny
    "send-price-alerts": {
        "task": "app.tasks.scheduled_tasks.send_price_alerts",
        "schedule": timedelta(hours=4),
        "options": {"queue": "notifications"}
    },
    
    # Týdenní souhrny - každou neděli ve 20:00
    "send-weekly-summaries": {
        "task": "app.tasks.scheduled_tasks.send_weekly_summaries",
        "schedule": timedelta(days=7),
        "options": {"queue": "notifications"}
    },
    
    # Čištění starých dat - každý den ve 2:00
    "cleanup-old-data": {
        "task": "app.tasks.scheduled_tasks.cleanup_old_data",
        "schedule": timedelta(hours=24),
        "options": {"queue": "maintenance"}
    },
    
    # Automatické zálohy - každý den ve 4:00
    "create-automatic-backups": {
        "task": "app.tasks.scheduled_tasks.create_automatic_backups",
        "schedule": timedelta(hours=24),
        "options": {"queue": "backups"}
    },
    
    # Aktualizace kalendáře událostí - každé 6 hodin
    "update-calendar-events": {
        "task": "app.tasks.scheduled_tasks.update_calendar_events",
        "schedule": timedelta(hours=6),
        "options": {"queue": "scraping"}
    },
    
    # Generování měsíčních reportů - 1. den v měsíci ve 6:00
    "generate-monthly-reports": {
        "task": "app.tasks.scheduled_tasks.generate_monthly_reports",
        "schedule": timedelta(days=30),
        "options": {"queue": "reports"}
    },
}

# Error handling
@celery_app.task(bind=True)
def debug_task(self):
    """Debug úloha pro testování"""
    print(f"Request: {self.request!r}")
    return "Debug task completed"

# Health check
@celery_app.task
def health_check():
    """Health check úloha"""
    return {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}

if __name__ == "__main__":
    celery_app.start()