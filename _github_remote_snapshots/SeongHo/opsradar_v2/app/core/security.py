from datetime import datetime, timedelta, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def token_expiry(minutes: int) -> datetime:
    return utc_now() + timedelta(minutes=minutes)
