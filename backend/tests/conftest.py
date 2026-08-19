import os
import sys
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "fincontrol_test")
os.environ.setdefault("CORS_ORIGINS", "*")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pymongo  # noqa: E402
import pytest  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

import server as server_module  # noqa: E402

# Limpieza vía pymongo SÍNCRONO, deliberadamente: el cliente motor (async) de
# server.py se ata al primer event loop que lo usa, y TestClient corre cada
# petición en el loop de su propio portal — si la limpieza usara motor con un
# loop manual aparte, el driver quedaría atado a ESE loop y las peticiones
# reales de los tests fallarían con "attached to a different loop".
_cliente_sincrono: pymongo.MongoClient = pymongo.MongoClient(os.environ["MONGO_URL"])
_base_de_test = _cliente_sincrono[os.environ["DB_NAME"]]


@pytest.fixture(autouse=True)
def limpiar_base_de_datos():
    """Deja la base de datos de test vacía antes de cada test: cada test parte de cero."""
    for nombre in _base_de_test.list_collection_names():
        _base_de_test[nombre].delete_many({})
    yield


@pytest.fixture(scope="session")
def client():
    # Un único TestClient para toda la sesión, deliberadamente: motor guarda su
    # loop de referencia en el cliente global de server.py, y abrir/cerrar un
    # TestClient (y por tanto un event loop) por test deja ese cliente atado a
    # un loop ya cerrado en el siguiente test ("Event loop is closed").
    with TestClient(server_module.app) as test_client:
        yield test_client
