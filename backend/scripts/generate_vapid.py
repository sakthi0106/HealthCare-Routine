"""
Creates the key pair used for background reminders.

Usage (from the backend/ folder):
    python -m scripts.generate_vapid

Copy the lines it prints into backend/.env AND into the Render environment.
Keep VAPID_PRIVATE_KEY secret. Create the keys ONCE: changing them later switches every phone off
until it taps "Turn on reminders" again.
"""
import base64
import secrets

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid01


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


vapid = Vapid01()
vapid.generate_keys()
public = vapid.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
private = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")

print("\nAdd these to backend/.env and to Render -> Environment:\n")
print(f"VAPID_PUBLIC_KEY={b64(public)}")
print(f"VAPID_PRIVATE_KEY={b64(private)}")
print("VAPID_SUBJECT=mailto:YOUR-EMAIL@example.com")
print(f"CRON_SECRET={secrets.token_urlsafe(24)}\n")
