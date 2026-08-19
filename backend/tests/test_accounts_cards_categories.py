def test_alta_de_cuenta_la_deja_disponible_en_el_listado(client):
    respuesta = client.post(
        "/api/accounts",
        json={"name": "Cuenta Nómina", "type": "bank", "currency": "EUR"},
    )
    assert respuesta.status_code == 200
    cuenta = respuesta.json()
    assert cuenta["name"] == "Cuenta Nómina"
    assert cuenta["id"]

    listado = client.get("/api/accounts")
    assert listado.status_code == 200
    assert any(c["id"] == cuenta["id"] for c in listado.json())


def test_borrar_cuenta_borra_tambien_sus_movimientos(client):
    cuenta = client.post("/api/accounts", json={"name": "Cuenta a borrar"}).json()
    client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-01-01",
            "concept": "Compra",
            "amount": -10.0,
            "type": "expense",
        },
    )

    borrado = client.delete(f"/api/accounts/{cuenta['id']}")
    assert borrado.status_code == 200

    movimientos = client.get("/api/transactions", params={"account_id": cuenta["id"]})
    assert movimientos.json() == []


def test_borrar_cuenta_inexistente_da_404(client):
    respuesta = client.delete("/api/accounts/no-existe")
    assert respuesta.status_code == 404


def test_alta_de_tarjeta_la_deja_disponible_en_el_listado(client):
    respuesta = client.post("/api/credit-cards", json={"name": "Visa", "last4": "1234"})
    assert respuesta.status_code == 200
    tarjeta = respuesta.json()

    listado = client.get("/api/credit-cards")
    assert any(t["id"] == tarjeta["id"] for t in listado.json())


def test_categoria_y_subcategoria_se_pueden_dar_de_alta_y_editar(client):
    categoria = client.post("/api/categories", json={"name": "Alimentación"}).json()
    subcategoria = client.post(
        "/api/subcategories",
        json={
            "category_id": categoria["id"],
            "name": "Supermercado",
        },
    ).json()

    editada = client.put(f"/api/categories/{categoria['id']}", json={"name": "Comida"})
    assert editada.status_code == 200
    assert editada.json()["name"] == "Comida"

    listado_sub = client.get(
        "/api/subcategories", params={"category_id": categoria["id"]}
    )
    assert any(s["id"] == subcategoria["id"] for s in listado_sub.json())


def test_borrar_categoria_borra_sus_subcategorias(client):
    categoria = client.post("/api/categories", json={"name": "Ocio"}).json()
    client.post(
        "/api/subcategories", json={"category_id": categoria["id"], "name": "Cine"}
    )

    client.delete(f"/api/categories/{categoria['id']}")

    subcategorias = client.get(
        "/api/subcategories", params={"category_id": categoria["id"]}
    )
    assert subcategorias.json() == []
