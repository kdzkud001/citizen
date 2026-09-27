from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.routers import clans, habits, health, lyfta, me


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = None
    if get_settings().enable_inprocess_scheduler:
        # Local/single-instance dev convenience only -- see README for why
        # scripts/sync_all.py run from cron is the recommended production
        # path (an in-process scheduler has no cross-process lock, so it
        # double-syncs the moment you run more than one worker).
        from apscheduler.schedulers.background import BackgroundScheduler

        from scripts.sync_all import sync_all_connected_users

        scheduler = BackgroundScheduler()
        scheduler.add_job(sync_all_connected_users, "interval", hours=1, id="lyfta_sync_all")
        scheduler.start()

    yield

    if scheduler is not None:
        scheduler.shutdown()


app = FastAPI(title="Citizenship Score API", lifespan=lifespan)

app.include_router(health.router)
app.include_router(me.router)
app.include_router(lyfta.router)
app.include_router(habits.router)
app.include_router(clans.router)
