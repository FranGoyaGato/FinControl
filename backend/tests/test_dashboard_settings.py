def test_dashboard_resume_ingresos_gastos_y_saldo_neto(client):
    cuenta = client.post("/api/accounts", json={"name": "Cuenta"}).json()
    client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-01-01",
            "concept": "Nómina",
            "amount": 1500.0,
            "type": "income",
        },
    )
    client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-01-05",
            "concept": "Alquiler",
            "amount": -600.0,
            "type": "expense",
        },
    )

    dashboard = client.get("/api/dashboard", params={"account_id": cuenta["id"]})
    assert dashboard.status_code == 200
    cuerpo = dashboard.json()
    assert cuerpo["total_income"] == 1500.0
    assert cuerpo["total_expense"] == 600.0
    assert cuerpo["net_flow"] == 900.0
    assert cuerpo["transaction_count"] == 2


def test_settings_tiene_valores_por_defecto_y_se_pueden_editar(client):
    valores = client.get("/api/settings")
    assert valores.status_code == 200
    assert valores.json()["currency_symbol"] == "€"

    editados = client.put(
        "/api/settings", json={"currency_symbol": "$", "locale": "en-US"}
    )
    assert editados.status_code == 200
    assert editados.json()["currency_symbol"] == "$"

    releidos = client.get("/api/settings")
    assert releidos.json()["currency_symbol"] == "$"
