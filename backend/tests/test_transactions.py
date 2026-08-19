def _crear_cuenta(client, nombre="Cuenta"):
    return client.post("/api/accounts", json={"name": nombre}).json()


def _crear_tarjeta(client, nombre="Tarjeta"):
    return client.post("/api/credit-cards", json={"name": nombre}).json()


def test_apuntar_un_movimiento_lo_deja_visible_en_el_listado(client):
    cuenta = _crear_cuenta(client)
    respuesta = client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-03-05",
            "concept": "Mercadona",
            "amount": -45.30,
            "type": "expense",
        },
    )
    assert respuesta.status_code == 200
    movimiento = respuesta.json()
    assert movimiento["concept"] == "Mercadona"
    assert movimiento["dedup_hash"]

    listado = client.get("/api/transactions", params={"account_id": cuenta["id"]})
    assert len(listado.json()) == 1


def test_apuntar_el_mismo_movimiento_dos_veces_se_rechaza_como_duplicado(client):
    cuenta = _crear_cuenta(client)
    datos = {
        "account_id": cuenta["id"],
        "date": "2026-03-05",
        "concept": "Mercadona",
        "amount": -45.30,
        "type": "expense",
    }
    primero = client.post("/api/transactions", json=datos)
    assert primero.status_code == 200

    segundo = client.post("/api/transactions", json=datos)
    assert segundo.status_code == 400


def test_filtrar_movimientos_por_categoria_y_rango_de_fechas(client):
    cuenta = _crear_cuenta(client)
    categoria = client.post("/api/categories", json={"name": "Casa"}).json()
    client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-01-10",
            "concept": "Alquiler",
            "amount": -600.0,
            "type": "expense",
            "category_id": categoria["id"],
        },
    )
    client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-02-10",
            "concept": "Nómina",
            "amount": 1500.0,
            "type": "income",
        },
    )

    filtrado = client.get(
        "/api/transactions",
        params={
            "category_id": categoria["id"],
            "date_from": "2026-01-01",
            "date_to": "2026-01-31",
        },
    )
    resultados = filtrado.json()
    assert len(resultados) == 1
    assert resultados[0]["concept"] == "Alquiler"


def test_editar_categoria_de_un_movimiento(client):
    cuenta = _crear_cuenta(client)
    categoria = client.post("/api/categories", json={"name": "Transporte"}).json()
    movimiento = client.post(
        "/api/transactions",
        json={
            "account_id": cuenta["id"],
            "date": "2026-01-01",
            "concept": "Metro",
            "amount": -1.5,
            "type": "expense",
        },
    ).json()

    editado = client.put(
        f"/api/transactions/{movimiento['id']}",
        params={"category_id": categoria["id"]},
    )
    assert editado.status_code == 200
    assert editado.json()["category_id"] == categoria["id"]


def test_apuntar_y_listar_movimientos_de_tarjeta(client):
    tarjeta = _crear_tarjeta(client)
    respuesta = client.post(
        "/api/card-transactions",
        json={
            "card_id": tarjeta["id"],
            "date": "2026-04-01",
            "concept": "Amazon",
            "amount": -30.0,
        },
    )
    assert respuesta.status_code == 200

    listado = client.get("/api/card-transactions", params={"card_id": tarjeta["id"]})
    assert len(listado.json()) == 1
