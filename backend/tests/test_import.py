CSV_EXTRACTO = (
    "fecha;concepto;importe\n"
    "01/03/2026;Mercadona;-45,30\n"
    "02/03/2026;Nómina Empresa;1.500,00\n"
)


def test_importar_csv_devuelve_preview_con_fechas_normalizadas_e_importes_correctos(
    client,
):
    cuenta = client.post("/api/accounts", json={"name": "Cuenta"}).json()

    respuesta = client.post(
        "/api/import/parse-csv",
        params={"import_type": "account", "entity_id": cuenta["id"]},
        files={"file": ("extracto.csv", CSV_EXTRACTO, "text/csv")},
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["count"] == 2

    primera = cuerpo["preview"][0]
    assert primera["date"] == "2026-03-01"
    assert primera["concept"] == "Mercadona"
    assert primera["amount"] == -45.30
    assert primera["type"] == "expense"

    segunda = cuerpo["preview"][1]
    assert segunda["date"] == "2026-03-02"
    assert segunda["amount"] == 1500.00
    assert segunda["type"] == "income"


def test_confirmar_import_inserta_movimientos_y_detecta_duplicados_en_una_segunda_pasada(
    client,
):
    cuenta = client.post("/api/accounts", json={"name": "Cuenta"}).json()
    preview = client.post(
        "/api/import/parse-csv",
        params={"import_type": "account", "entity_id": cuenta["id"]},
        files={"file": ("extracto.csv", CSV_EXTRACTO, "text/csv")},
    ).json()

    primera_confirmacion = client.post(
        "/api/import/confirm",
        json={
            "import_type": "account",
            "entity_id": cuenta["id"],
            "transactions": preview["preview"],
        },
    )
    assert primera_confirmacion.status_code == 200
    assert primera_confirmacion.json()["inserted"] == 2
    assert primera_confirmacion.json()["duplicates"] == 0

    segunda_confirmacion = client.post(
        "/api/import/confirm",
        json={
            "import_type": "account",
            "entity_id": cuenta["id"],
            "transactions": preview["preview"],
        },
    )
    assert segunda_confirmacion.json()["inserted"] == 0
    assert segunda_confirmacion.json()["duplicates"] == 2

    movimientos = client.get(
        "/api/transactions", params={"account_id": cuenta["id"]}
    ).json()
    assert len(movimientos) == 2


def test_importar_fichero_de_formato_no_soportado_da_400(client):
    respuesta = client.post(
        "/api/import/parse-csv",
        params={"import_type": "account", "entity_id": "cualquiera"},
        files={"file": ("extracto.txt", "contenido", "text/plain")},
    )
    assert respuesta.status_code == 400
