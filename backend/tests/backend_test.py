"""Regression suite for the personal finance app (post code-quality refactor).

Modules covered:
- health / root
- dashboard KPIs
- transactions & card-transactions filters
- CRUD: accounts, credit-cards, categories, subcategories, rules
- rules retroactive application (bank + card)
- import: parse-csv (.csv / .xls / .xlsx) + confirm (insert + dedup)
"""
import io
import uuid

import pytest
import requests

from conftest import API

TEST_PREFIX = "TEST_"


# ---------- shared helpers ----------
def _uniq(name):
    return f"{TEST_PREFIX}{name}_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    yield s
    s.close()


@pytest.fixture(scope="module")
def cleanup(sess):
    """Track created resources for teardown."""
    created = {"accounts": [], "credit-cards": [], "categories": [], "subcategories": [], "rules": []}
    yield created
    for kind in ["rules", "subcategories", "categories", "credit-cards", "accounts"]:
        for rid in created[kind]:
            try:
                sess.delete(f"{API}/{kind}/{rid}", timeout=30)
            except Exception:
                pass


# ============ HEALTH ============
class TestHealth:
    def test_root(self, sess):
        r = sess.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert r.json()["message"] == "Finance Control API"


# ============ DASHBOARD ============
class TestDashboard:
    def test_dashboard_shape(self, sess):
        r = sess.get(f"{API}/dashboard", timeout=60)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_income", "total_expense", "net_flow", "transaction_count"]:
            assert k in d
        assert isinstance(d["transaction_count"], int)
        assert d["total_expense"] >= 0, "expense must be absolute value"
        assert round(d["net_flow"], 2) == round(d["total_income"] - d["total_expense"], 2)

    def test_dashboard_month_filter(self, sess):
        r = sess.get(f"{API}/dashboard", params={"date_from": "2025-01-01", "date_to": "2025-01-31"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        full = sess.get(f"{API}/dashboard", timeout=60).json()
        assert d["transaction_count"] <= full["transaction_count"]

    def test_dashboard_year_filter(self, sess):
        r = sess.get(f"{API}/dashboard", params={"date_from": "2025-01-01", "date_to": "2025-12-31"}, timeout=60)
        assert r.status_code == 200
        assert r.json()["transaction_count"] >= 0

    def test_dashboard_account_filter(self, sess):
        accounts = sess.get(f"{API}/accounts", timeout=30).json()
        if not accounts:
            pytest.skip("no accounts seeded")
        acc = accounts[0]["id"]
        r = sess.get(f"{API}/dashboard", params={"account_id": acc}, timeout=60)
        assert r.status_code == 200
        txs = sess.get(f"{API}/transactions", params={"account_id": acc}, timeout=60).json()
        assert r.json()["transaction_count"] == len(txs)


# ============ TRANSACTIONS FILTERS ============
class TestTransactions:
    def test_list_all(self, sess):
        r = sess.get(f"{API}/transactions", timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            assert "_id" not in data[0]
            for k in ["id", "account_id", "date", "concept", "amount", "type", "dedup_hash"]:
                assert k in data[0]

    def test_sorted_desc_by_date(self, sess):
        data = sess.get(f"{API}/transactions", timeout=60).json()
        dates = [t["date"] for t in data]
        assert dates == sorted(dates, reverse=True)

    @pytest.mark.parametrize("tx_type", ["income", "expense"])
    def test_filter_type(self, sess, tx_type):
        r = sess.get(f"{API}/transactions", params={"type": tx_type}, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert all(t["type"] == tx_type for t in data)

    def test_filter_date_range(self, sess):
        r = sess.get(f"{API}/transactions", params={"date_from": "2025-01-01", "date_to": "2025-01-31"}, timeout=60)
        assert r.status_code == 200
        for t in r.json():
            assert "2025-01-01" <= t["date"] <= "2025-01-31"

    def test_filter_category(self, sess):
        cats = sess.get(f"{API}/categories", timeout=30).json()
        if not cats:
            pytest.skip("no categories")
        cid = cats[0]["id"]
        r = sess.get(f"{API}/transactions", params={"category_id": cid}, timeout=60)
        assert r.status_code == 200
        assert all(t["category_id"] == cid for t in r.json())


# ============ CARD TRANSACTIONS ============
class TestCardTransactions:
    def test_list(self, sess):
        r = sess.get(f"{API}/card-transactions", timeout=60)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_card_id(self, sess):
        cards = sess.get(f"{API}/credit-cards", timeout=30).json()
        if not cards:
            pytest.skip("no cards seeded")
        cid = cards[0]["id"]
        r = sess.get(f"{API}/card-transactions", params={"card_id": cid}, timeout=60)
        assert r.status_code == 200
        assert all(t["card_id"] == cid for t in r.json())

    def test_filter_bogus_card_id_returns_empty(self, sess):
        r = sess.get(f"{API}/card-transactions", params={"card_id": "nope-" + uuid.uuid4().hex}, timeout=30)
        assert r.status_code == 200
        assert r.json() == []


# ============ CRUD ============
class TestCrud:
    def test_account_crud(self, sess, cleanup):
        name = _uniq("acc")
        r = sess.post(f"{API}/accounts", json={"name": name, "type": "bank", "currency": "EUR"}, timeout=30)
        assert r.status_code == 200, r.text
        acc = r.json()
        cleanup["accounts"].append(acc["id"])
        assert acc["name"] == name
        assert acc["currency"] == "EUR"
        listed = sess.get(f"{API}/accounts", timeout=30).json()
        assert any(a["id"] == acc["id"] for a in listed)
        d = sess.delete(f"{API}/accounts/{acc['id']}", timeout=30)
        assert d.status_code == 200
        cleanup["accounts"].remove(acc["id"])
        listed = sess.get(f"{API}/accounts", timeout=30).json()
        assert not any(a["id"] == acc["id"] for a in listed)
        assert sess.delete(f"{API}/accounts/{acc['id']}", timeout=30).status_code == 404

    def test_card_crud(self, sess, cleanup):
        name = _uniq("card")
        r = sess.post(f"{API}/credit-cards", json={"name": name, "last4": "4242"}, timeout=30)
        assert r.status_code == 200, r.text
        card = r.json()
        cleanup["credit-cards"].append(card["id"])
        assert card["name"] == name and card["last4"] == "4242"
        assert any(c["id"] == card["id"] for c in sess.get(f"{API}/credit-cards", timeout=30).json())
        assert sess.delete(f"{API}/credit-cards/{card['id']}", timeout=30).status_code == 200
        cleanup["credit-cards"].remove(card["id"])
        assert sess.delete(f"{API}/credit-cards/{card['id']}", timeout=30).status_code == 404

    def test_category_and_subcategory_crud(self, sess, cleanup):
        cname = _uniq("cat")
        r = sess.post(f"{API}/categories", json={"name": cname}, timeout=30)
        assert r.status_code == 200, r.text
        cat = r.json()
        cleanup["categories"].append(cat["id"])

        # update category
        newname = cname + "_upd"
        u = sess.put(f"{API}/categories/{cat['id']}", json={"name": newname}, timeout=30)
        assert u.status_code == 200
        assert u.json()["name"] == newname
        assert any(c["name"] == newname for c in sess.get(f"{API}/categories", timeout=30).json())

        # subcategory
        sname = _uniq("sub")
        s = sess.post(f"{API}/subcategories", json={"category_id": cat["id"], "name": sname}, timeout=30)
        assert s.status_code == 200, s.text
        sub = s.json()
        cleanup["subcategories"].append(sub["id"])
        assert sub["category_id"] == cat["id"]
        filtered = sess.get(f"{API}/subcategories", params={"category_id": cat["id"]}, timeout=30).json()
        assert [x["id"] for x in filtered] == [sub["id"]]

        su = sess.put(f"{API}/subcategories/{sub['id']}", json={"category_id": cat["id"], "name": sname + "_upd"}, timeout=30)
        assert su.status_code == 200
        assert su.json()["name"] == sname + "_upd"

        # deleting category cascades subcategories
        assert sess.delete(f"{API}/categories/{cat['id']}", timeout=30).status_code == 200
        cleanup["categories"].remove(cat["id"])
        cleanup["subcategories"].remove(sub["id"])
        assert sess.get(f"{API}/subcategories", params={"category_id": cat["id"]}, timeout=30).json() == []

    def test_404s(self, sess):
        bogus = uuid.uuid4().hex
        assert sess.put(f"{API}/categories/{bogus}", json={"name": "x"}, timeout=30).status_code == 404
        assert sess.delete(f"{API}/subcategories/{bogus}", timeout=30).status_code == 404
        assert sess.delete(f"{API}/rules/{bogus}", timeout=30).status_code == 404
        assert sess.put(f"{API}/transactions/{bogus}", timeout=30).status_code == 404
        assert sess.put(f"{API}/card-transactions/{bogus}", timeout=30).status_code == 404

    def test_settings(self, sess):
        r = sess.get(f"{API}/settings", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["locale"] == "es-ES"
        assert d["currency_symbol"] == "€"


# ============ RULES RETROACTIVE ============
class TestRulesRetroactive:
    @pytest.fixture(scope="class")
    def fixture_env(self, sess, cleanup):
        """Create an isolated account, card, category, and transactions."""
        token = uuid.uuid4().hex[:10].upper()
        concept = f"TEST_RETRO_{token}"

        acc = sess.post(f"{API}/accounts", json={"name": _uniq("retroacc")}, timeout=30).json()
        cleanup["accounts"].append(acc["id"])
        card = sess.post(f"{API}/credit-cards", json={"name": _uniq("retrocard")}, timeout=30).json()
        cleanup["credit-cards"].append(card["id"])
        cat = sess.post(f"{API}/categories", json={"name": _uniq("retrocat")}, timeout=30).json()
        cleanup["categories"].append(cat["id"])

        tx = sess.post(f"{API}/transactions", json={
            "account_id": acc["id"], "date": "2025-03-15",
            "concept": f"Compra {concept} tienda", "amount": -45.5, "type": "expense",
        }, timeout=30)
        assert tx.status_code == 200, tx.text

        ctx = sess.post(f"{API}/card-transactions", json={
            "card_id": card["id"], "date": "2025-03-16",
            "concept": f"Pago {concept} online", "amount": -22.25,
        }, timeout=30)
        assert ctx.status_code == 200, ctx.text

        return {"concept": concept, "acc": acc, "card": card, "cat": cat,
                "tx_id": tx.json()["id"], "ctx_id": ctx.json()["id"]}

    def test_create_rule_applies_to_bank(self, sess, cleanup, fixture_env):
        r = sess.post(f"{API}/rules", json={
            "source": "bank", "contains": fixture_env["concept"],
            "category_id": fixture_env["cat"]["id"], "priority": 5, "active": True,
        }, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        cleanup["rules"].append(body["rule"]["id"])
        assert body["applied_to_existing"] >= 1
        assert "aplicada" in body["message"]

        txs = sess.get(f"{API}/transactions", params={"account_id": fixture_env["acc"]["id"]}, timeout=30).json()
        assert txs[0]["category_id"] == fixture_env["cat"]["id"]

    def test_create_rule_applies_to_card(self, sess, cleanup, fixture_env):
        r = sess.post(f"{API}/rules", json={
            "source": "card", "contains": fixture_env["concept"],
            "category_id": fixture_env["cat"]["id"], "priority": 5, "active": True,
        }, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        cleanup["rules"].append(body["rule"]["id"])
        assert body["applied_to_existing"] >= 1
        ctxs = sess.get(f"{API}/card-transactions", params={"card_id": fixture_env["card"]["id"]}, timeout=30).json()
        assert ctxs[0]["category_id"] == fixture_env["cat"]["id"]

    def test_update_rule_reapplies(self, sess, cleanup, fixture_env):
        cat2 = sess.post(f"{API}/categories", json={"name": _uniq("retrocat2")}, timeout=30).json()
        cleanup["categories"].append(cat2["id"])

        rule = sess.post(f"{API}/rules", json={
            "source": "bank", "contains": fixture_env["concept"],
            "category_id": fixture_env["cat"]["id"], "priority": 1,
        }, timeout=60).json()["rule"]
        cleanup["rules"].append(rule["id"])

        u = sess.put(f"{API}/rules/{rule['id']}", json={
            "source": "bank", "contains": fixture_env["concept"],
            "category_id": cat2["id"], "priority": 9, "active": True,
        }, timeout=60)
        assert u.status_code == 200, u.text
        assert u.json()["applied_to_existing"] >= 1
        assert u.json()["rule"]["category_id"] == cat2["id"]

        txs = sess.get(f"{API}/transactions", params={"account_id": fixture_env["acc"]["id"]}, timeout=30).json()
        assert txs[0]["category_id"] == cat2["id"]

        rules = sess.get(f"{API}/rules", timeout=30).json()
        got = [x for x in rules if x["id"] == rule["id"]]
        assert got and got[0]["priority"] == 9

    @pytest.mark.xfail(reason="KNOWN BUG: `contains` is injected raw into $regex without re.escape, "
                              "so concepts containing regex metacharacters are never matched retroactively",
                       strict=False)
    def test_rule_with_regex_metacharacters_in_concept(self, sess, cleanup):
        """A concept with regex metachars (*, +) must still be matched literally."""
        acc = sess.post(f"{API}/accounts", json={"name": _uniq("rxacc")}, timeout=30).json()
        cleanup["accounts"].append(acc["id"])
        cat = sess.post(f"{API}/categories", json={"name": _uniq("rxcat")}, timeout=30).json()
        cleanup["categories"].append(cat["id"])
        concept = f"TEST_RX *SPECIAL* +{uuid.uuid4().hex[:6]}"
        assert sess.post(f"{API}/transactions", json={
            "account_id": acc["id"], "date": "2025-09-01", "concept": concept,
            "amount": -9.9, "type": "expense"}, timeout=30).status_code == 200

        r = sess.post(f"{API}/rules", json={
            "source": "bank", "contains": concept, "category_id": cat["id"], "priority": 5}, timeout=60)
        assert r.status_code == 200, r.text
        cleanup["rules"].append(r.json()["rule"]["id"])
        assert r.json()["applied_to_existing"] >= 1, "rule did not match its own transaction"

    def test_rules_sorted_by_priority_desc(self, sess):
        rules = sess.get(f"{API}/rules", timeout=30).json()
        prios = [x["priority"] for x in rules]
        assert prios == sorted(prios, reverse=True)


# ============ IMPORT (parse-csv refactor) ============
CSV_BODY = (
    "Fecha;Concepto;Importe\n"
    "15/04/2025;NOMINA EMPRESA TESTIMP;1.234,56\n"
    "16/04/2025;COMPRA SUPER TESTIMP;-1.234,56\n"
    "17/04/2025;RECIBO LUZ TESTIMP;-89,90\n"
)


def _xlsx_bytes(rows):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(["Fecha", "Concepto", "Importe"])
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _xls_bytes(rows):
    import xlwt
    wb = xlwt.Workbook()
    ws = wb.add_sheet("Sheet1")
    for c, h in enumerate(["Fecha", "Concepto", "Importe"]):
        ws.write(0, c, h)
    for ri, r in enumerate(rows, start=1):
        for ci, v in enumerate(r):
            ws.write(ri, ci, v)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class TestImport:
    @pytest.fixture(scope="class")
    def imp_env(self, sess, cleanup):
        acc = sess.post(f"{API}/accounts", json={"name": _uniq("impacc")}, timeout=30).json()
        cleanup["accounts"].append(acc["id"])
        card = sess.post(f"{API}/credit-cards", json={"name": _uniq("impcard")}, timeout=30).json()
        cleanup["credit-cards"].append(card["id"])
        cat = sess.post(f"{API}/categories", json={"name": _uniq("impcat")}, timeout=30).json()
        cleanup["categories"].append(cat["id"])
        rule = sess.post(f"{API}/rules", json={
            "source": "bank", "contains": "NOMINA EMPRESA TESTIMP",
            "category_id": cat["id"], "priority": 50,
        }, timeout=60).json()["rule"]
        cleanup["rules"].append(rule["id"])
        return {"acc": acc, "card": card, "cat": cat}

    def test_parse_csv(self, sess, imp_env):
        r = sess.post(
            f"{API}/import/parse-csv",
            params={"import_type": "account", "entity_id": imp_env["acc"]["id"]},
            files={"file": ("mov.csv", CSV_BODY.encode("utf-8"), "text/csv")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["count"] == 3
        p = d["preview"]
        # date normalization DD/MM/YYYY -> ISO
        assert p[0]["date"] == "2025-04-15"
        # es-ES amount parsing 1.234,56 -> 1234.56
        assert p[0]["amount"] == 1234.56
        assert p[1]["amount"] == -1234.56
        assert p[2]["amount"] == -89.90
        # type derivation for accounts
        assert p[0]["type"] == "income"
        assert p[1]["type"] == "expense"
        # auto-categorization via rules
        assert p[0]["category_id"] == imp_env["cat"]["id"]
        assert p[1]["category_id"] is None

    def test_parse_csv_card_has_no_type(self, sess, imp_env):
        r = sess.post(
            f"{API}/import/parse-csv",
            params={"import_type": "card", "entity_id": imp_env["card"]["id"]},
            files={"file": ("mov.csv", CSV_BODY.encode("utf-8"), "text/csv")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        assert all("type" not in row for row in r.json()["preview"])

    def test_parse_xlsx(self, sess, imp_env):
        content = _xlsx_bytes([
            ["15/04/2025", "NOMINA EMPRESA TESTIMP", 1234.56],
            ["16/04/2025", "COMPRA SUPER TESTIMP", -1234.56],
        ])
        r = sess.post(
            f"{API}/import/parse-csv",
            params={"import_type": "account", "entity_id": imp_env["acc"]["id"]},
            files={"file": ("mov.xlsx", content,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["count"] == 2
        assert d["detected_columns"] == ["fecha", "concepto", "importe"]
        assert d["preview"][0]["amount"] == 1234.56
        assert d["preview"][0]["date"] == "2025-04-15"
        assert d["preview"][0]["category_id"] == imp_env["cat"]["id"]
        assert d["preview"][1]["amount"] == -1234.56

    def test_parse_xls(self, sess, imp_env):
        pytest.importorskip("xlwt")
        content = _xls_bytes([
            ["15/04/2025", "NOMINA EMPRESA TESTIMP", 1234.56],
            ["16/04/2025", "COMPRA SUPER TESTIMP", -1234.56],
        ])
        r = sess.post(
            f"{API}/import/parse-csv",
            params={"import_type": "account", "entity_id": imp_env["acc"]["id"]},
            files={"file": ("mov.xls", content, "application/vnd.ms-excel")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["count"] == 2
        assert d["preview"][0]["amount"] == 1234.56
        assert d["preview"][0]["date"] == "2025-04-15"
        assert d["preview"][1]["amount"] == -1234.56

    def test_unsupported_format(self, sess, imp_env):
        r = sess.post(
            f"{API}/import/parse-csv",
            params={"import_type": "account", "entity_id": imp_env["acc"]["id"]},
            files={"file": ("mov.txt", b"hello", "text/plain")},
            timeout=30,
        )
        assert r.status_code == 400
        assert "no soportado" in r.json()["detail"]

    def test_confirm_inserts_then_dedups(self, sess, imp_env):
        parsed = sess.post(
            f"{API}/import/parse-csv",
            params={"import_type": "account", "entity_id": imp_env["acc"]["id"]},
            files={"file": ("mov.csv", CSV_BODY.encode("utf-8"), "text/csv")},
            timeout=60,
        ).json()["preview"]

        payload = {"import_type": "account", "entity_id": imp_env["acc"]["id"], "transactions": parsed}
        r1 = sess.post(f"{API}/import/confirm", json=payload, timeout=60)
        assert r1.status_code == 200, r1.text
        assert r1.json() == {"inserted": 3, "duplicates": 0, "errors": 0}

        txs = sess.get(f"{API}/transactions", params={"account_id": imp_env["acc"]["id"]}, timeout=30).json()
        assert len(txs) == 3
        income = [t for t in txs if t["type"] == "income"]
        assert len(income) == 1 and income[0]["amount"] == 1234.56
        assert income[0]["category_id"] == imp_env["cat"]["id"]

        r2 = sess.post(f"{API}/import/confirm", json=payload, timeout=60)
        assert r2.status_code == 200
        assert r2.json() == {"inserted": 0, "duplicates": 3, "errors": 0}

        dash = sess.get(f"{API}/dashboard", params={"account_id": imp_env["acc"]["id"]}, timeout=30).json()
        assert round(dash["total_income"], 2) == 1234.56
        assert round(dash["total_expense"], 2) == 1324.46
        assert dash["transaction_count"] == 3

    def test_confirm_card_inserts_and_dedups(self, sess, imp_env):
        parsed = sess.post(
            f"{API}/import/parse-csv",
            params={"import_type": "card", "entity_id": imp_env["card"]["id"]},
            files={"file": ("mov.csv", CSV_BODY.encode("utf-8"), "text/csv")},
            timeout=60,
        ).json()["preview"]
        payload = {"import_type": "card", "entity_id": imp_env["card"]["id"], "transactions": parsed}
        r1 = sess.post(f"{API}/import/confirm", json=payload, timeout=60)
        assert r1.status_code == 200
        assert r1.json()["inserted"] == 3
        r2 = sess.post(f"{API}/import/confirm", json=payload, timeout=60)
        assert r2.json()["duplicates"] == 3
        ctxs = sess.get(f"{API}/card-transactions", params={"card_id": imp_env["card"]["id"]}, timeout=30).json()
        assert len(ctxs) == 3


# ============ INLINE CATEGORIZATION (used by TransactionRow dropdowns) ============
class TestInlineCategorization:
    def test_update_transaction_category(self, sess, cleanup):
        acc = sess.post(f"{API}/accounts", json={"name": _uniq("inlacc")}, timeout=30).json()
        cleanup["accounts"].append(acc["id"])
        cat = sess.post(f"{API}/categories", json={"name": _uniq("inlcat")}, timeout=30).json()
        cleanup["categories"].append(cat["id"])
        sub = sess.post(f"{API}/subcategories", json={"category_id": cat["id"], "name": _uniq("inlsub")}, timeout=30).json()
        cleanup["subcategories"].append(sub["id"])

        tx = sess.post(f"{API}/transactions", json={
            "account_id": acc["id"], "date": "2025-05-01",
            "concept": "TEST_INLINE_CONCEPT", "amount": -10.0, "type": "expense",
        }, timeout=30).json()

        u = sess.put(f"{API}/transactions/{tx['id']}",
                     params={"category_id": cat["id"], "subcategory_id": sub["id"]}, timeout=30)
        assert u.status_code == 200, u.text
        assert u.json()["category_id"] == cat["id"]
        assert u.json()["subcategory_id"] == sub["id"]

        got = sess.get(f"{API}/transactions", params={"account_id": acc["id"]}, timeout=30).json()[0]
        assert got["category_id"] == cat["id"]
        assert got["subcategory_id"] == sub["id"]

    def test_update_card_transaction_category(self, sess, cleanup):
        card = sess.post(f"{API}/credit-cards", json={"name": _uniq("inlcard")}, timeout=30).json()
        cleanup["credit-cards"].append(card["id"])
        cat = sess.post(f"{API}/categories", json={"name": _uniq("inlcat2")}, timeout=30).json()
        cleanup["categories"].append(cat["id"])

        ctx = sess.post(f"{API}/card-transactions", json={
            "card_id": card["id"], "date": "2025-05-02",
            "concept": "TEST_INLINE_CARD", "amount": -30.0,
        }, timeout=30).json()

        u = sess.put(f"{API}/card-transactions/{ctx['id']}", params={"category_id": cat["id"]}, timeout=30)
        assert u.status_code == 200, u.text
        assert u.json()["category_id"] == cat["id"]
        got = sess.get(f"{API}/card-transactions", params={"card_id": card["id"]}, timeout=30).json()[0]
        assert got["category_id"] == cat["id"]

    def test_duplicate_transaction_rejected(self, sess, cleanup):
        acc = sess.post(f"{API}/accounts", json={"name": _uniq("dupacc")}, timeout=30).json()
        cleanup["accounts"].append(acc["id"])
        body = {"account_id": acc["id"], "date": "2025-06-01", "concept": "TEST_DUP", "amount": -5.0, "type": "expense"}
        assert sess.post(f"{API}/transactions", json=body, timeout=30).status_code == 200
        r = sess.post(f"{API}/transactions", json=body, timeout=30)
        assert r.status_code == 400
        assert "Duplicate" in r.json()["detail"]
