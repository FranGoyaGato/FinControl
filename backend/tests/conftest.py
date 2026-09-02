import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


def load_credentials():
    """Read admin credentials from /app/memory/test_credentials.md, falling back to
    /app/backend/.env (the credentials doc now only points at ADMIN_EMAIL/ADMIN_PASSWORD)."""
    path = Path("/app/memory/test_credentials.md")
    if path.exists():
        content = path.read_text(encoding="utf-8")
        email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
        pwd = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
        if email and pwd and "@" in email.group(1):
            return {"email": email.group(1), "password": pwd.group(1)}

    backend_env = dotenv_values("/app/backend/.env")
    admin_email = backend_env.get("ADMIN_EMAIL")
    admin_password = backend_env.get("ADMIN_PASSWORD")
    if admin_email and admin_password:
        return {"email": admin_email.strip().lower(), "password": admin_password}
    return None


@pytest.fixture(scope="session")
def credentials():
    creds = load_credentials()
    if not creds:
        pytest.skip("Missing credentials in /app/memory/test_credentials.md")
    return creds


def get_token(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed ({r.status_code}): {r.text[:300]}")
    token = r.json().get("token")
    if not token:
        pytest.fail("Login response missing token")
    return token


@pytest.fixture(scope="session")
def auth_token(credentials):
    return get_token(credentials["email"], credentials["password"])


@pytest.fixture(scope="session")
def api():
    return API


@pytest.fixture(scope="class")
def client(auth_token):
    s = requests.Session()
    s.headers.update({"Accept": "application/json", "Authorization": f"Bearer {auth_token}"})
    return s
