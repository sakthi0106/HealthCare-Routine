"""In-memory stand-in for Google Sheets, used ONLY by the tests."""
from models.schema import DEFAULT_SETTINGS, SHEETS
from services.store import Store


class MemoryStore(Store):
    def __init__(self):
        self.data = {name: [] for name in SHEETS}

    def read(self, sheet):
        return [dict(r) for r in self.data[sheet]]

    def append_many(self, sheet, records):
        for r in records:
            self.data[sheet].append({c: str(r.get(c, "")) for c in SHEETS[sheet]})

    def update(self, sheet, key_col, key, updates):
        for r in self.data[sheet]:
            if r[key_col] == str(key):
                r.update({k: str(v) for k, v in updates.items()})
                return True
        return False

    def delete(self, sheet, key_col, key):
        before = len(self.data[sheet])
        self.data[sheet] = [r for r in self.data[sheet] if r[key_col] != str(key)]
        return len(self.data[sheet]) < before
