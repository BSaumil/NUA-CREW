"""Ingestion worker: `python -m app.worker` (loop) or `--once` (drain and exit).

Each pass: enqueue due scheduled sources, expire stale ingested jobs, then process due tasks.
Stops cleanly on SIGINT/SIGTERM after the task in hand.
"""

import argparse
import asyncio
import logging
import os
import signal
import socket
from collections import Counter

from app.config import get_settings
from app.db import assert_rls_safe_role, dispose_engine, get_sessionmaker
from app.rls import set_context
from app.services.alerts import run_alerts
from app.services.ingestion.queue import expire_stale, process_one, schedule_due
from app.services.invitations import sweep_expired
from app.services.push import deliver_pending

log = logging.getLogger("nua.worker")


def worker_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}"


async def run_once(max_tasks: int = 1000) -> Counter[str]:
    """One full pass. Returns counts of outcomes (plus `scheduled` and `expired`)."""
    factory = get_sessionmaker()
    stats: Counter[str] = Counter()
    async with factory() as s:
        await set_context(s, role="system")
        stats["scheduled"] = await schedule_due(s)
        stats["expired"] = await expire_stale(s, get_settings().ingestion_stale_after_seconds)
        stats["alerts"] = await run_alerts(s)
        stats["invitations_expired"] = await sweep_expired(s)
        await s.commit()
    async with factory() as s:
        await set_context(s, role="system")
        stats["pushed"] = await deliver_pending(s)
        await s.commit()
    wid = worker_id()
    for _ in range(max_tasks):
        outcome = await process_one(factory, wid)
        if outcome is None:
            break
        stats[outcome.result] += 1
    return stats


async def serve(poll_seconds: float, stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            stats = await run_once()
            if any(stats.values()):
                log.info("pass complete %s", dict(stats))
        except Exception:
            log.exception("worker pass failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=poll_seconds)
        except TimeoutError:
            pass


async def _main(once: bool, poll: float) -> None:
    await assert_rls_safe_role()
    if once:
        print(dict(await run_once()))  # noqa: T201
    else:
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop.set)
        await serve(poll, stop)
    await dispose_engine()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    p = argparse.ArgumentParser(description="NUA CREW ingestion worker")
    p.add_argument("--once", action="store_true", help="drain due work then exit")
    p.add_argument("--poll", type=float, default=10.0, help="seconds between passes")
    args = p.parse_args()
    asyncio.run(_main(args.once, args.poll))


if __name__ == "__main__":
    main()
