import json
import shutil
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from api.storage import describe_storage_backend, read_db


def summarize_db(db):
    chats = db.get("chats", {}) if isinstance(db.get("chats"), dict) else {}
    chat_sessions = []
    for sessions in chats.values():
        if isinstance(sessions, list):
            chat_sessions.extend(sessions)
    return {
        "users": len(db.get("users", [])),
        "sessions": len(db.get("sessions", [])),
        "chatUsers": len(chats),
        "chatSessions": len(chat_sessions),
        "messages": sum(len(session.get("messages") or []) for session in chat_sessions),
    }


class Command(BaseCommand):
    help = "Show active app storage details and optionally back up the legacy JSON file store."

    def add_arguments(self, parser):
        parser.add_argument(
            "--backup-file-store",
            action="store_true",
            help="Copy the legacy JSON file store into server/data/backups before printing the storage summary.",
        )

    def handle(self, *args, **options):
        backup_path = None
        source_path = Path(settings.ENERGY_APP_DATA_FILE)

        if options["backup_file_store"] and source_path.exists():
            backup_dir = source_path.parent / "backups"
            backup_dir.mkdir(parents=True, exist_ok=True)
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            backup_path = backup_dir / f"app-data.backup-{timestamp}.json"
            shutil.copy2(source_path, backup_path)

        payload = {
            "storage": describe_storage_backend(),
            "counts": summarize_db(read_db()),
        }

        if backup_path is not None:
            payload["backupFile"] = str(backup_path)

        self.stdout.write(json.dumps(payload, indent=2))
