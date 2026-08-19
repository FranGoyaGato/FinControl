def test_crear_regla_categoriza_tambien_los_movimientos_ya_existentes(client):
    cuenta = client.post("/api/accounts", json={"name": "Cuenta"}).json()
    categoria = client.post("/api/categories", json={"name": "Alimentación"}).json()
    movimiento = client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-01-01",
            "concept": "Mercadona Alcorcón",
            "amount": -10.0,
            "type": "expense",
        },
    ).json()
    assert movimiento["category_id"] is None

    respuesta = client.post(
        "/api/rules",
        json={
            "source": "bank",
            "contains": "mercadona",
            "sign": "-",
            "category_id": categoria["id"],
        },
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["applied_to_existing"] == 1

    movimientos = client.get(
        "/api/transactions", params={"account_id": cuenta["id"]}
    ).json()
    assert movimientos[0]["category_id"] == categoria["id"]


def test_nuevo_movimiento_se_autocategoriza_con_la_regla_ya_creada(client):
    cuenta = client.post("/api/accounts", json={"name": "Cuenta"}).json()
    categoria = client.post("/api/categories", json={"name": "Transporte"}).json()
    client.post(
        "/api/rules",
        json={
            "source": "bank",
            "contains": "metro",
            "category_id": categoria["id"],
        },
    )

    preview = client.post(
        "/api/import/parse-csv",
        params={"import_type": "account", "entity_id": cuenta["id"]},
        files={
            "file": (
                "mov.csv",
                "fecha;concepto;importe\n01/03/2026;Metro Madrid;-1,50\n",
                "text/csv",
            )
        },
    ).json()

    assert preview["preview"][0]["category_id"] == categoria["id"]


def test_regla_con_signo_no_categoriza_el_signo_contrario(client):
    cuenta = client.post("/api/accounts", json={"name": "Cuenta"}).json()
    categoria = client.post("/api/categories", json={"name": "Ingresos varios"}).json()
    client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-01-01",
            "concept": "Devolución compra",
            "amount": -5.0,
            "type": "expense",
        },
    ).json()

    client.post(
        "/api/rules",
        json={
            "source": "bank",
            "contains": "devolución",
            "sign": "+",
            "category_id": categoria["id"],
        },
    )

    movimientos = client.get(
        "/api/transactions", params={"account_id": cuenta["id"]}
    ).json()
    assert movimientos[0]["category_id"] is None


def test_borrar_regla_inexistente_da_404(client):
    respuesta = client.delete("/api/rules/no-existe")
    assert respuesta.status_code == 404
