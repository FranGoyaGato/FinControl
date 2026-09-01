"""Auth tests: login, me, logout, change-password, and 401 gating of all /api routes.

IMPORTANT: the change-password happy-path test rotates the password and restores it
to the seeded value at the end so /app/memory/test_credentials.md stays valid.
"""
import requests

import pytest

from conftest import API, get_token


# ============ LOGIN ============
class TestLogin:
    def test_login_success(self, credentials):
        r = requests.post(f"{API}/auth/login", json=credentials, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("token"), str) and len(data["token"]) > 20
        assert data["user"]["email"] == credentials["email"]
        assert "id" in data["user"]
        assert "password_hash" not in data["user"]
        assert "_id" not in data["user"]

    def test_login_wrong_password(self, credentials):
        r = requests.post(f"{API}/auth/login",
                          json={"email": credentials["email"], "password": "totally-wrong-pw"},
                          timeout=30)
        assert r.status_code == 401
        assert r.json()["detail"] == "Email o contraseña incorrectos"

    def test_login_unknown_email(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "nobody@example.com", "password": "whatever12"},
                          timeout=30)
        assert r.status_code == 401

    def test_login_invalid_email_format(self):
        r = requests.post(f"{API}/auth/login", json={"email": "not-an-email", "password": "x"}, timeout=30)
        assert r.status_code == 422

    def test_login_email_case_insensitive(self, credentials):
        r = requests.post(f"{API}/auth/login",
                          json={"email": credentials["email"].upper(), "password": credentials["password"]},
                          timeout=30)
        assert r.status_code == 200, r.text


# ============ ME / LOGOUT ============
class TestMeLogout:
    def test_me_with_token(self, auth_token, credentials):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {auth_token}"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == credentials["email"]
        assert "password_hash" not in data
        assert "_id" not in data

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401
        assert r.json()["detail"] == "No autenticado"

    def test_me_invalid_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage.token.here"}, timeout=30)
        assert r.status_code == 401
        assert r.json()["detail"] == "Token inválido"

    def test_me_malformed_scheme(self, auth_token):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": auth_token}, timeout=30)
        assert r.status_code == 401

    def test_logout(self, auth_token):
        r = requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {auth_token}"}, timeout=30)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_logout_without_token(self):
        r = requests.post(f"{API}/auth/logout", timeout=30)
        assert r.status_code == 401


# ============ 401 GATING OF ALL PROTECTED ROUTES ============
PROTECTED_GETS = [
    "/", "/dashboard", "/dashboard/expense-by-category", "/dashboard/monthly-summary?year=2025",
    "/accounts", "/credit-cards", "/categories", "/subcategories", "/transactions",
    "/card-transactions", "/rules", "/settings",
]
PROTECTED_POSTS = [
    "/accounts", "/credit-cards", "/categories", "/subcategories", "/rules",
    "/transactions", "/card-transactions", "/import/confirm",
]


class TestAuthGating:
    @pytest.mark.parametrize("path", PROTECTED_GETS)
    def test_get_requires_auth(self, path):
        r = requests.get(f"{API}{path}", timeout=30)
        assert r.status_code == 401, f"{path} -> {r.status_code}"

    @pytest.mark.parametrize("path", PROTECTED_POSTS)
    def test_post_requires_auth(self, path):
        r = requests.post(f"{API}{path}", json={}, timeout=30)
        assert r.status_code == 401, f"{path} -> {r.status_code}"

    def test_parse_csv_requires_auth(self):
        r = requests.post(f"{API}/import/parse-csv",
                          files={"file": ("a.csv", b"x", "text/csv")}, timeout=30)
        assert r.status_code == 401

    def test_mutations_require_auth(self):
        for method, path in [("put", "/categories/x"), ("delete", "/categories/x"),
                             ("put", "/rules/x"), ("delete", "/rules/x"),
                             ("put", "/transactions/x"), ("put", "/card-transactions/x"),
                             ("delete", "/accounts/x"), ("delete", "/credit-cards/x"),
                             ("put", "/subcategories/x"), ("delete", "/subcategories/x"),
                             ("put", "/settings")]:
            r = getattr(requests, method)(f"{API}{path}", json={}, timeout=30)
            assert r.status_code == 401, f"{method} {path} -> {r.status_code}"

    @pytest.mark.parametrize("path", PROTECTED_GETS)
    def test_get_with_valid_token(self, path, auth_token):
        r = requests.get(f"{API}{path}", headers={"Authorization": f"Bearer {auth_token}"}, timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:200]}"


# ============ CHANGE PASSWORD ============
class TestChangePassword:
    def test_requires_auth(self):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": "a", "new_password": "abcdefgh"}, timeout=30)
        assert r.status_code == 401

    def test_wrong_current_password(self, auth_token):
        r = requests.post(f"{API}/auth/change-password",
                          headers={"Authorization": f"Bearer {auth_token}"},
                          json={"current_password": "definitely-wrong", "new_password": "abcdefgh1"},
                          timeout=30)
        assert r.status_code == 400
        assert r.json()["detail"] == "Contraseña actual incorrecta"

    def test_short_new_password(self, auth_token, credentials):
        r = requests.post(f"{API}/auth/change-password",
                          headers={"Authorization": f"Bearer {auth_token}"},
                          json={"current_password": credentials["password"], "new_password": "short7"},
                          timeout=30)
        assert r.status_code == 422

    def test_rotate_and_restore(self, credentials):
        """Rotate password, verify old fails + new works, then restore the seed password."""
        original = credentials["password"]
        temp = "TEST_Rotated_9988"
        token = get_token(credentials["email"], original)

        r = requests.post(f"{API}/auth/change-password",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"current_password": original, "new_password": temp}, timeout=30)
        assert r.status_code == 200, r.text

        try:
            # old password no longer works
            r_old = requests.post(f"{API}/auth/login",
                                  json={"email": credentials["email"], "password": original}, timeout=30)
            assert r_old.status_code == 401

            # new password works
            r_new = requests.post(f"{API}/auth/login",
                                  json={"email": credentials["email"], "password": temp}, timeout=30)
            assert r_new.status_code == 200, r_new.text
            new_token = r_new.json()["token"]

            # existing token still valid (stateless JWT, sub unchanged)
            r_me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_token}"}, timeout=30)
            assert r_me.status_code == 200
        finally:
            # ALWAYS restore the seeded password
            tok = requests.post(f"{API}/auth/login",
                                json={"email": credentials["email"], "password": temp},
                                timeout=30).json().get("token")
            restore = requests.post(f"{API}/auth/change-password",
                                    headers={"Authorization": f"Bearer {tok}"},
                                    json={"current_password": temp, "new_password": original}, timeout=30)
            assert restore.status_code == 200, f"FAILED TO RESTORE PASSWORD: {restore.text}"

        # confirm restored
        r_final = requests.post(f"{API}/auth/login",
                                json={"email": credentials["email"], "password": original}, timeout=30)
        assert r_final.status_code == 200
