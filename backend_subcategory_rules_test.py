#!/usr/bin/env python3
"""
Comprehensive test for subcategory rules functionality
Tests the complete flow requested in the review request
"""

import requests
import json
import sys
from datetime import datetime

class SubcategoryRulesTest:
    def __init__(self, base_url="https://budgetpal-246.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.headers = {'Content-Type': 'application/json'}
        
        # Test data storage
        self.account_id = None
        self.category_id = None
        self.subcategory_supermercado_id = None
        self.subcategory_restaurantes_id = None
        self.transaction_mercadona_id = None
        self.transaction_carrefour_id = None
        self.transaction_burger_id = None
        self.rule1_id = None
        self.rule2_id = None
        self.rule3_id = None
        
        # Test results
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.critical_failures = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            print(f"❌ {name}")
            if details:
                print(f"   {details}")
            self.critical_failures.append(f"{name}: {details}")
        
        self.test_results.append({
            "test": name,
            "status": "PASSED" if success else "FAILED",
            "details": details
        })

    def make_request(self, method, endpoint, data=None, params=None):
        """Make HTTP request and return response"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=self.headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=self.headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=self.headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=self.headers)
            
            return response
        except Exception as e:
            print(f"❌ Request failed: {str(e)}")
            return None

    def test_1_setup_inicial(self):
        """1. Setup inicial: crear cuenta, categoría y subcategorías"""
        print("\n🏗️  PASO 1: Setup inicial")
        
        # Crear cuenta bancaria
        response = self.make_request('POST', 'accounts', {"name": "Cuenta Test"})
        if response and response.status_code == 200:
            data = response.json()
            self.account_id = data['id']
            self.log_test("Crear cuenta bancaria", True, f"ID: {self.account_id}")
        else:
            self.log_test("Crear cuenta bancaria", False, f"Status: {response.status_code if response else 'No response'}")
            return False

        # Crear categoría principal "Alimentación"
        response = self.make_request('POST', 'categories', {"name": "Alimentación"})
        if response and response.status_code == 200:
            data = response.json()
            self.category_id = data['id']
            self.log_test("Crear categoría Alimentación", True, f"ID: {self.category_id}")
        else:
            self.log_test("Crear categoría Alimentación", False, f"Status: {response.status_code if response else 'No response'}")
            return False

        # Crear subcategoría "Supermercado"
        response = self.make_request('POST', 'subcategories', {
            "name": "Supermercado", 
            "category_id": self.category_id
        })
        if response and response.status_code == 200:
            data = response.json()
            self.subcategory_supermercado_id = data['id']
            self.log_test("Crear subcategoría Supermercado", True, f"ID: {self.subcategory_supermercado_id}")
        else:
            self.log_test("Crear subcategoría Supermercado", False, f"Status: {response.status_code if response else 'No response'}")
            return False

        # Crear subcategoría "Restaurantes"
        response = self.make_request('POST', 'subcategories', {
            "name": "Restaurantes", 
            "category_id": self.category_id
        })
        if response and response.status_code == 200:
            data = response.json()
            self.subcategory_restaurantes_id = data['id']
            self.log_test("Crear subcategoría Restaurantes", True, f"ID: {self.subcategory_restaurantes_id}")
        else:
            self.log_test("Crear subcategoría Restaurantes", False, f"Status: {response.status_code if response else 'No response'}")
            return False

        return True

    def test_2_crear_transacciones_prueba(self):
        """2. Crear transacciones de prueba"""
        print("\n💰 PASO 2: Crear transacciones de prueba")
        
        if not self.account_id:
            self.log_test("Crear transacciones", False, "No hay account_id disponible")
            return False

        # Transacción 1: MERCADONA COMPRA
        response = self.make_request('POST', 'transactions', {
            "account_id": self.account_id,
            "date": "2025-01-15",
            "concept": "MERCADONA COMPRA",
            "amount": -45.50,
            "type": "expense",
            "category_id": None,
            "subcategory_id": None
        })
        if response and response.status_code == 200:
            data = response.json()
            self.transaction_mercadona_id = data['id']
            self.log_test("Crear transacción MERCADONA COMPRA", True, f"ID: {self.transaction_mercadona_id}")
        else:
            self.log_test("Crear transacción MERCADONA COMPRA", False, f"Status: {response.status_code if response else 'No response'}")

        # Transacción 2: CARREFOUR TIENDA
        response = self.make_request('POST', 'transactions', {
            "account_id": self.account_id,
            "date": "2025-01-16",
            "concept": "CARREFOUR TIENDA",
            "amount": -32.20,
            "type": "expense",
            "category_id": None,
            "subcategory_id": None
        })
        if response and response.status_code == 200:
            data = response.json()
            self.transaction_carrefour_id = data['id']
            self.log_test("Crear transacción CARREFOUR TIENDA", True, f"ID: {self.transaction_carrefour_id}")
        else:
            self.log_test("Crear transacción CARREFOUR TIENDA", False, f"Status: {response.status_code if response else 'No response'}")

        # Transacción 3: BURGUER KING
        response = self.make_request('POST', 'transactions', {
            "account_id": self.account_id,
            "date": "2025-01-17",
            "concept": "BURGUER KING",
            "amount": -15.80,
            "type": "expense",
            "category_id": None,
            "subcategory_id": None
        })
        if response and response.status_code == 200:
            data = response.json()
            self.transaction_burger_id = data['id']
            self.log_test("Crear transacción BURGUER KING", True, f"ID: {self.transaction_burger_id}")
        else:
            self.log_test("Crear transacción BURGUER KING", False, f"Status: {response.status_code if response else 'No response'}")

        return True

    def test_3_regla_con_subcategoria(self):
        """3. Prueba de regla con subcategoría"""
        print("\n⚙️  PASO 3: Crear regla con subcategoría")
        
        if not all([self.category_id, self.subcategory_supermercado_id]):
            self.log_test("Crear regla con subcategoría", False, "Faltan IDs necesarios")
            return False

        # Crear regla 1 para MERCADONA con subcategoría Supermercado
        response = self.make_request('POST', 'rules', {
            "source": "bank",
            "contains": "MERCADONA",
            "sign": "",
            "category_id": self.category_id,
            "subcategory_id": self.subcategory_supermercado_id,
            "priority": 0
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.rule1_id = data['rule']['id']
            applied_count = data.get('applied_to_existing', 0)
            
            # Verificar que se aplicó a 1 transacción existente
            if applied_count == 1:
                self.log_test("Crear regla MERCADONA con subcategoría", True, 
                            f"ID: {self.rule1_id}, Aplicada a {applied_count} transacción(es)")
            else:
                self.log_test("Crear regla MERCADONA con subcategoría", False, 
                            f"Se esperaba aplicar a 1 transacción, se aplicó a {applied_count}")
                return False
        else:
            self.log_test("Crear regla MERCADONA con subcategoría", False, 
                        f"Status: {response.status_code if response else 'No response'}")
            return False

        # Verificar que la transacción MERCADONA tiene category_id y subcategory_id correctos
        response = self.make_request('GET', 'transactions')
        if response and response.status_code == 200:
            transactions = response.json()
            mercadona_tx = next((tx for tx in transactions if 'MERCADONA' in tx['concept']), None)
            
            if mercadona_tx:
                if (mercadona_tx.get('category_id') == self.category_id and 
                    mercadona_tx.get('subcategory_id') == self.subcategory_supermercado_id):
                    self.log_test("Verificar categorización MERCADONA", True, 
                                "Transacción correctamente categorizada con subcategoría")
                else:
                    self.log_test("Verificar categorización MERCADONA", False, 
                                f"Category: {mercadona_tx.get('category_id')}, Subcategory: {mercadona_tx.get('subcategory_id')}")
                    return False
            else:
                self.log_test("Verificar categorización MERCADONA", False, "No se encontró la transacción")
                return False
        else:
            self.log_test("Verificar categorización MERCADONA", False, "Error al obtener transacciones")
            return False

        return True

    def test_4_regla_sin_subcategoria(self):
        """4. Prueba de regla sin subcategoría"""
        print("\n⚙️  PASO 4: Crear regla sin subcategoría")
        
        if not self.category_id:
            self.log_test("Crear regla sin subcategoría", False, "Falta category_id")
            return False

        # Crear regla 2 para CARREFOUR sin subcategoría
        response = self.make_request('POST', 'rules', {
            "source": "bank",
            "contains": "CARREFOUR",
            "sign": "",
            "category_id": self.category_id,
            "subcategory_id": None,
            "priority": 0
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.rule2_id = data['rule']['id']
            applied_count = data.get('applied_to_existing', 0)
            
            # Verificar que se aplicó a 1 transacción existente
            if applied_count == 1:
                self.log_test("Crear regla CARREFOUR sin subcategoría", True, 
                            f"ID: {self.rule2_id}, Aplicada a {applied_count} transacción(es)")
            else:
                self.log_test("Crear regla CARREFOUR sin subcategoría", False, 
                            f"Se esperaba aplicar a 1 transacción, se aplicó a {applied_count}")
                return False
        else:
            self.log_test("Crear regla CARREFOUR sin subcategoría", False, 
                        f"Status: {response.status_code if response else 'No response'}")
            return False

        # Verificar que la transacción CARREFOUR tiene category_id pero subcategory_id es null
        response = self.make_request('GET', 'transactions')
        if response and response.status_code == 200:
            transactions = response.json()
            carrefour_tx = next((tx for tx in transactions if 'CARREFOUR' in tx['concept']), None)
            
            if carrefour_tx:
                if (carrefour_tx.get('category_id') == self.category_id and 
                    carrefour_tx.get('subcategory_id') is None):
                    self.log_test("Verificar categorización CARREFOUR", True, 
                                "Transacción correctamente categorizada sin subcategoría")
                else:
                    self.log_test("Verificar categorización CARREFOUR", False, 
                                f"Category: {carrefour_tx.get('category_id')}, Subcategory: {carrefour_tx.get('subcategory_id')}")
                    return False
            else:
                self.log_test("Verificar categorización CARREFOUR", False, "No se encontró la transacción")
                return False
        else:
            self.log_test("Verificar categorización CARREFOUR", False, "Error al obtener transacciones")
            return False

        return True

    def test_5_actualizar_regla_agregar_subcategoria(self):
        """5. Actualizar regla agregando subcategoría"""
        print("\n🔄 PASO 5: Actualizar regla agregando subcategoría")
        
        if not all([self.rule2_id, self.category_id, self.subcategory_supermercado_id]):
            self.log_test("Actualizar regla agregando subcategoría", False, "Faltan IDs necesarios")
            return False

        # Actualizar regla 2 agregando subcategoría
        response = self.make_request('PUT', f'rules/{self.rule2_id}', {
            "source": "bank",
            "contains": "CARREFOUR",
            "sign": "",
            "category_id": self.category_id,
            "subcategory_id": self.subcategory_supermercado_id,
            "priority": 0,
            "active": True
        })
        
        if response and response.status_code == 200:
            data = response.json()
            applied_count = data.get('applied_to_existing', 0)
            
            # Verificar que se aplicó retroactivamente
            if applied_count >= 1:
                self.log_test("Actualizar regla CARREFOUR con subcategoría", True, 
                            f"Aplicada retroactivamente a {applied_count} transacción(es)")
            else:
                self.log_test("Actualizar regla CARREFOUR con subcategoría", False, 
                            f"No se aplicó retroactivamente (applied_count: {applied_count})")
                return False
        else:
            self.log_test("Actualizar regla CARREFOUR con subcategoría", False, 
                        f"Status: {response.status_code if response else 'No response'}")
            return False

        # Verificar que la transacción CARREFOUR ahora tiene la subcategoría asignada
        response = self.make_request('GET', 'transactions')
        if response and response.status_code == 200:
            transactions = response.json()
            carrefour_tx = next((tx for tx in transactions if 'CARREFOUR' in tx['concept']), None)
            
            if carrefour_tx:
                if (carrefour_tx.get('category_id') == self.category_id and 
                    carrefour_tx.get('subcategory_id') == self.subcategory_supermercado_id):
                    self.log_test("Verificar actualización retroactiva CARREFOUR", True, 
                                "Transacción ahora tiene subcategoría asignada")
                else:
                    self.log_test("Verificar actualización retroactiva CARREFOUR", False, 
                                f"Category: {carrefour_tx.get('category_id')}, Subcategory: {carrefour_tx.get('subcategory_id')}")
                    return False
            else:
                self.log_test("Verificar actualización retroactiva CARREFOUR", False, "No se encontró la transacción")
                return False
        else:
            self.log_test("Verificar actualización retroactiva CARREFOUR", False, "Error al obtener transacciones")
            return False

        return True

    def test_6_multiples_reglas_prioridad(self):
        """6. Prueba con múltiples reglas y prioridad"""
        print("\n🎯 PASO 6: Múltiples reglas con prioridad")
        
        if not all([self.category_id, self.subcategory_restaurantes_id]):
            self.log_test("Crear regla con mayor prioridad", False, "Faltan IDs necesarios")
            return False

        # Crear regla 3 con mayor prioridad para "BURGUER" con subcategoría "Restaurantes"
        response = self.make_request('POST', 'rules', {
            "source": "bank",
            "contains": "BURGUER",
            "sign": "",
            "category_id": self.category_id,
            "subcategory_id": self.subcategory_restaurantes_id,
            "priority": 10  # Mayor prioridad
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.rule3_id = data['rule']['id']
            applied_count = data.get('applied_to_existing', 0)
            
            # Verificar que se aplicó a 1 transacción existente
            if applied_count == 1:
                self.log_test("Crear regla BURGUER con mayor prioridad", True, 
                            f"ID: {self.rule3_id}, Aplicada a {applied_count} transacción(es)")
            else:
                self.log_test("Crear regla BURGUER con mayor prioridad", False, 
                            f"Se esperaba aplicar a 1 transacción, se aplicó a {applied_count}")
                return False
        else:
            self.log_test("Crear regla BURGUER con mayor prioridad", False, 
                        f"Status: {response.status_code if response else 'No response'}")
            return False

        # Verificar que la transacción BURGUER KING se categorizó correctamente
        response = self.make_request('GET', 'transactions')
        if response and response.status_code == 200:
            transactions = response.json()
            burger_tx = next((tx for tx in transactions if 'BURGUER' in tx['concept']), None)
            
            if burger_tx:
                if (burger_tx.get('category_id') == self.category_id and 
                    burger_tx.get('subcategory_id') == self.subcategory_restaurantes_id):
                    self.log_test("Verificar categorización BURGUER KING", True, 
                                "Transacción correctamente categorizada con subcategoría Restaurantes")
                else:
                    self.log_test("Verificar categorización BURGUER KING", False, 
                                f"Category: {burger_tx.get('category_id')}, Subcategory: {burger_tx.get('subcategory_id')}")
                    return False
            else:
                self.log_test("Verificar categorización BURGUER KING", False, "No se encontró la transacción")
                return False
        else:
            self.log_test("Verificar categorización BURGUER KING", False, "Error al obtener transacciones")
            return False

        return True

    def test_7_verificaciones_finales(self):
        """7. Verificaciones finales"""
        print("\n✅ PASO 7: Verificaciones finales")
        
        # GET /api/rules - todas las reglas creadas deben estar listadas con sus subcategorías
        response = self.make_request('GET', 'rules')
        if response and response.status_code == 200:
            rules = response.json()
            created_rules = [r for r in rules if r['id'] in [self.rule1_id, self.rule2_id, self.rule3_id]]
            
            if len(created_rules) == 3:
                self.log_test("Verificar reglas creadas", True, f"Se encontraron las 3 reglas creadas")
                
                # Verificar que las reglas tienen las subcategorías correctas
                rule1 = next((r for r in created_rules if r['id'] == self.rule1_id), None)
                rule2 = next((r for r in created_rules if r['id'] == self.rule2_id), None)
                rule3 = next((r for r in created_rules if r['id'] == self.rule3_id), None)
                
                if (rule1 and rule1.get('subcategory_id') == self.subcategory_supermercado_id and
                    rule2 and rule2.get('subcategory_id') == self.subcategory_supermercado_id and
                    rule3 and rule3.get('subcategory_id') == self.subcategory_restaurantes_id):
                    self.log_test("Verificar subcategorías en reglas", True, "Todas las reglas tienen subcategorías correctas")
                else:
                    self.log_test("Verificar subcategorías en reglas", False, "Subcategorías incorrectas en reglas")
            else:
                self.log_test("Verificar reglas creadas", False, f"Se esperaban 3 reglas, se encontraron {len(created_rules)}")
        else:
            self.log_test("Verificar reglas creadas", False, "Error al obtener reglas")

        # GET /api/transactions - todas las transacciones deben tener categorías y subcategorías según las reglas
        response = self.make_request('GET', 'transactions')
        if response and response.status_code == 200:
            transactions = response.json()
            test_transactions = [tx for tx in transactions if tx['account_id'] == self.account_id]
            
            if len(test_transactions) == 3:
                self.log_test("Verificar transacciones creadas", True, f"Se encontraron las 3 transacciones de prueba")
                
                # Verificar categorización final
                all_categorized = True
                for tx in test_transactions:
                    if not tx.get('category_id') or not tx.get('subcategory_id'):
                        all_categorized = False
                        break
                
                if all_categorized:
                    self.log_test("Verificar categorización final", True, "Todas las transacciones tienen categoría y subcategoría")
                else:
                    self.log_test("Verificar categorización final", False, "Algunas transacciones no están completamente categorizadas")
            else:
                self.log_test("Verificar transacciones creadas", False, f"Se esperaban 3 transacciones, se encontraron {len(test_transactions)}")
        else:
            self.log_test("Verificar transacciones creadas", False, "Error al obtener transacciones")

        return True

    def check_backend_logs(self):
        """Check backend logs for errors"""
        print("\n📋 PASO 8: Verificar logs del backend")
        
        try:
            import subprocess
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                logs = result.stdout
                if logs.strip():
                    # Look for recent errors
                    error_lines = [line for line in logs.split('\n') if 'ERROR' in line.upper() or 'EXCEPTION' in line.upper()]
                    if error_lines:
                        self.log_test("Verificar logs del backend", False, f"Se encontraron {len(error_lines)} errores en logs")
                        for error in error_lines[-3:]:  # Show last 3 errors
                            print(f"   🔴 {error}")
                    else:
                        self.log_test("Verificar logs del backend", True, "No se encontraron errores recientes en logs")
                else:
                    self.log_test("Verificar logs del backend", True, "Logs vacíos - sin errores")
            else:
                self.log_test("Verificar logs del backend", False, "No se pudieron leer los logs")
        except Exception as e:
            self.log_test("Verificar logs del backend", False, f"Error al verificar logs: {str(e)}")

    def cleanup(self):
        """Clean up test data"""
        print("\n🧹 LIMPIEZA: Eliminando datos de prueba")
        
        # Delete rules
        for rule_id in [self.rule1_id, self.rule2_id, self.rule3_id]:
            if rule_id:
                response = self.make_request('DELETE', f'rules/{rule_id}')
                if response and response.status_code == 200:
                    print(f"   ✅ Regla {rule_id} eliminada")
                else:
                    print(f"   ❌ Error eliminando regla {rule_id}")

        # Delete subcategories
        for subcat_id in [self.subcategory_supermercado_id, self.subcategory_restaurantes_id]:
            if subcat_id:
                response = self.make_request('DELETE', f'subcategories/{subcat_id}')
                if response and response.status_code == 200:
                    print(f"   ✅ Subcategoría {subcat_id} eliminada")
                else:
                    print(f"   ❌ Error eliminando subcategoría {subcat_id}")

        # Delete category
        if self.category_id:
            response = self.make_request('DELETE', f'categories/{self.category_id}')
            if response and response.status_code == 200:
                print(f"   ✅ Categoría {self.category_id} eliminada")
            else:
                print(f"   ❌ Error eliminando categoría {self.category_id}")

        # Delete account (this will also delete transactions)
        if self.account_id:
            response = self.make_request('DELETE', f'accounts/{self.account_id}')
            if response and response.status_code == 200:
                print(f"   ✅ Cuenta {self.account_id} eliminada (incluye transacciones)")
            else:
                print(f"   ❌ Error eliminando cuenta {self.account_id}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 80)
        print("🧪 PRUEBA EXHAUSTIVA: Reglas de Categorización con Subcategorías")
        print("=" * 80)
        
        success = True
        
        # Run tests in sequence
        success &= self.test_1_setup_inicial()
        success &= self.test_2_crear_transacciones_prueba()
        success &= self.test_3_regla_con_subcategoria()
        success &= self.test_4_regla_sin_subcategoria()
        success &= self.test_5_actualizar_regla_agregar_subcategoria()
        success &= self.test_6_multiples_reglas_prioridad()
        success &= self.test_7_verificaciones_finales()
        
        # Check backend logs
        self.check_backend_logs()
        
        # Cleanup
        self.cleanup()
        
        # Print results
        print("\n" + "=" * 80)
        print(f"📊 RESULTADOS FINALES: {self.tests_passed}/{self.tests_run} pruebas exitosas")
        print("=" * 80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Tasa de éxito: {success_rate:.1f}%")
        
        if self.critical_failures:
            print(f"\n🔴 FALLOS CRÍTICOS ({len(self.critical_failures)}):")
            for failure in self.critical_failures:
                print(f"   • {failure}")
        
        # Save detailed results
        results = {
            "timestamp": datetime.now().isoformat(),
            "test_type": "subcategory_rules_comprehensive",
            "total_tests": self.tests_run,
            "passed": self.tests_passed,
            "failed": self.tests_run - self.tests_passed,
            "success_rate": f"{success_rate:.1f}%",
            "critical_failures": self.critical_failures,
            "test_details": self.test_results
        }
        
        with open('/app/subcategory_rules_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n📄 Resultados detallados guardados en: /app/subcategory_rules_test_results.json")
        
        return success

def main():
    tester = SubcategoryRulesTest()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())