"""Manual test: idempotent admin seed must NOT reset a rotated password on backend restart.

Run standalone: python /app/backend/tests/manual_seed_idempotency.py
Restores the seeded password at the end.
"""
import subprocess
import sys
import time

import requests

sys.path.insert(0, "/app/backend/tests")
from conftest import API, load_credentials  # noqa: E402

TEMP = "TEST_Rotated_5566"


def login(email, pwd):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=30)


def change(token, cur, new):
    return requests.post(f"{API}/auth/change-password",
                         headers={"Authorization": f"Bearer {token}"},
                         json={"current_password": cur, "new_password": new}, timeout=30)


def wait_up(timeout=90):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if requests.get(f"{API}/auth/me", timeout=10).status_code == 401:
                return True
        except Exception:
            pass
        time.sleep(2)
    return False


def main():
    creds = load_credentials()
    orig = creds["password"]
    email = creds["email"]
    ok = True

    r = login(email, orig)
    assert r.status_code == 200, r.text
    token = r.json()["token"]

    print("1) Rotating password via API...")
    assert change(token, orig, TEMP).status_code == 200

    print("2) Restarting backend (triggers seed_admin)...")
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True)
    assert wait_up(), "backend did not come back up"
    time.sleep(3)

    print("3) Verifying .env/original password does NOT work...")
    r_old = login(email, orig)
    if r_old.status_code != 401:
        ok = False
        print(f"   FAIL: seed reset the password, .env password works ({r_old.status_code})")
    else:
        print("   OK: 401 as expected (seed is idempotent)")

    print("4) Verifying rotated password still works...")
    r_new = login(email, TEMP)
    if r_new.status_code != 200:
        ok = False
        print(f"   FAIL: rotated password broken ({r_new.status_code}) {r_new.text[:200]}")
    else:
        print("   OK: rotated password works")

    print("5) Verifying no duplicate user documents...")
    dup = subprocess.run(
        ["python", "-c",
         "import os,asyncio;from motor.motor_asyncio import AsyncIOMotorClient as C;"
         "from dotenv import load_dotenv;load_dotenv('/app/backend/.env');"
         "d=C(os.environ['MONGO_URL'])[os.environ['DB_NAME']];"
         "print(asyncio.get_event_loop().run_until_complete(d.users.count_documents({})))"],
        capture_output=True, text=True)
    print(f"   user count: {dup.stdout.strip()} {dup.stderr.strip()[:200]}")
    if dup.stdout.strip() != "1":
        ok = False
        print("   FAIL: expected exactly 1 user document")

    print("6) Restoring seeded password...")
    tok = login(email, TEMP).json().get("token")
    r_restore = change(tok, TEMP, orig)
    assert r_restore.status_code == 200, f"RESTORE FAILED: {r_restore.text}"
    assert login(email, orig).status_code == 200, "restore verification failed"
    print("   OK: seeded password restored")

    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
