import requests
import sys
from datetime import datetime
import json

class FinanceAPITester:
    def __init__(self, base_url="https://budgetpal-246.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Store created IDs for cleanup and testing
        self.account_id = None
        self.card_id = None
        self.category_id = None
        self.subcategory_id = None
        self.rule_id = None
        self.transaction_id = None
        self.card_transaction_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                self.test_results.append({"test": name, "status": "PASSED", "code": response.status_code})
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.test_results.append({"test": name, "status": "FAILED", "code": response.status_code, "expected": expected_status})

            try:
                return success, response.json() if response.text else {}
            except:
                return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({"test": name, "status": "ERROR", "error": str(e)})
            return False, {}

    def test_root(self):
        """Test root endpoint"""
        success, response = self.run_test(
            "Root Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_create_account(self):
        """Test creating an account"""
        success, response = self.run_test(
            "Create Account",
            "POST",
            "accounts",
            200,
            data={"name": "Test Account", "type": "bank", "currency": "EUR"}
        )
        if success and 'id' in response:
            self.account_id = response['id']
            print(f"   Created account ID: {self.account_id}")
        return success

    def test_get_accounts(self):
        """Test getting all accounts"""
        success, response = self.run_test(
            "Get Accounts",
            "GET",
            "accounts",
            200
        )
        if success:
            print(f"   Found {len(response)} accounts")
        return success

    def test_create_credit_card(self):
        """Test creating a credit card"""
        success, response = self.run_test(
            "Create Credit Card",
            "POST",
            "credit-cards",
            200,
            data={"name": "Test Card", "last4": "1234"}
        )
        if success and 'id' in response:
            self.card_id = response['id']
            print(f"   Created card ID: {self.card_id}")
        return success

    def test_get_credit_cards(self):
        """Test getting all credit cards"""
        success, response = self.run_test(
            "Get Credit Cards",
            "GET",
            "credit-cards",
            200
        )
        if success:
            print(f"   Found {len(response)} cards")
        return success

    def test_create_category(self):
        """Test creating a category"""
        success, response = self.run_test(
            "Create Category",
            "POST",
            "categories",
            200,
            data={"name": "Test Category"}
        )
        if success and 'id' in response:
            self.category_id = response['id']
            print(f"   Created category ID: {self.category_id}")
        return success

    def test_get_categories(self):
        """Test getting all categories"""
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "categories",
            200
        )
        if success:
            print(f"   Found {len(response)} categories")
        return success

    def test_create_subcategory(self):
        """Test creating a subcategory"""
        if not self.category_id:
            print("⚠️  Skipping - No category ID available")
            return False
        
        success, response = self.run_test(
            "Create Subcategory",
            "POST",
            "subcategories",
            200,
            data={"category_id": self.category_id, "name": "Test Subcategory"}
        )
        if success and 'id' in response:
            self.subcategory_id = response['id']
            print(f"   Created subcategory ID: {self.subcategory_id}")
        return success

    def test_get_subcategories(self):
        """Test getting all subcategories"""
        success, response = self.run_test(
            "Get Subcategories",
            "GET",
            "subcategories",
            200
        )
        if success:
            print(f"   Found {len(response)} subcategories")
        return success

    def test_create_rule(self):
        """Test creating a categorization rule"""
        if not self.category_id:
            print("⚠️  Skipping - No category ID available")
            return False
        
        success, response = self.run_test(
            "Create Rule",
            "POST",
            "rules",
            200,
            data={
                "source": "bank",
                "contains": "SALARY",
                "sign": "+",
                "category_id": self.category_id,
                "priority": 10,
                "active": True
            }
        )
        if success and 'id' in response:
            self.rule_id = response['id']
            print(f"   Created rule ID: {self.rule_id}")
        return success

    def test_get_rules(self):
        """Test getting all rules"""
        success, response = self.run_test(
            "Get Rules",
            "GET",
            "rules",
            200
        )
        if success:
            print(f"   Found {len(response)} rules")
        return success

    def test_create_transaction(self):
        """Test creating a transaction"""
        if not self.account_id:
            print("⚠️  Skipping - No account ID available")
            return False
        
        success, response = self.run_test(
            "Create Transaction",
            "POST",
            "transactions",
            200,
            data={
                "account_id": self.account_id,
                "date": "2025-01-15",
                "concept": "Test Income",
                "amount": 1000.50,
                "type": "income",
                "category_id": self.category_id
            }
        )
        if success and 'id' in response:
            self.transaction_id = response['id']
            print(f"   Created transaction ID: {self.transaction_id}")
        return success

    def test_get_transactions(self):
        """Test getting all transactions"""
        success, response = self.run_test(
            "Get Transactions",
            "GET",
            "transactions",
            200
        )
        if success:
            print(f"   Found {len(response)} transactions")
        return success

    def test_get_transactions_filtered(self):
        """Test getting filtered transactions"""
        if not self.account_id:
            print("⚠️  Skipping - No account ID available")
            return False
        
        success, response = self.run_test(
            "Get Transactions (Filtered)",
            "GET",
            "transactions",
            200,
            params={"type": "income", "account_id": self.account_id}
        )
        if success:
            print(f"   Found {len(response)} filtered transactions")
        return success

    def test_update_transaction(self):
        """Test updating a transaction category"""
        if not self.transaction_id or not self.category_id:
            print("⚠️  Skipping - No transaction or category ID available")
            return False
        
        success, response = self.run_test(
            "Update Transaction",
            "PUT",
            f"transactions/{self.transaction_id}",
            200,
            params={"category_id": self.category_id}
        )
        return success

    def test_create_card_transaction(self):
        """Test creating a card transaction"""
        if not self.card_id:
            print("⚠️  Skipping - No card ID available")
            return False
        
        success, response = self.run_test(
            "Create Card Transaction",
            "POST",
            "card-transactions",
            200,
            data={
                "card_id": self.card_id,
                "date": "2025-01-15",
                "concept": "Test Purchase",
                "amount": -50.25,
                "category_id": self.category_id
            }
        )
        if success and 'id' in response:
            self.card_transaction_id = response['id']
            print(f"   Created card transaction ID: {self.card_transaction_id}")
        return success

    def test_get_card_transactions(self):
        """Test getting all card transactions"""
        success, response = self.run_test(
            "Get Card Transactions",
            "GET",
            "card-transactions",
            200
        )
        if success:
            print(f"   Found {len(response)} card transactions")
        return success

    def test_update_card_transaction(self):
        """Test updating a card transaction category"""
        if not self.card_transaction_id or not self.category_id:
            print("⚠️  Skipping - No card transaction or category ID available")
            return False
        
        success, response = self.run_test(
            "Update Card Transaction",
            "PUT",
            f"card-transactions/{self.card_transaction_id}",
            200,
            params={"category_id": self.category_id}
        )
        return success

    def test_dashboard(self):
        """Test dashboard endpoint"""
        success, response = self.run_test(
            "Get Dashboard",
            "GET",
            "dashboard",
            200
        )
        if success:
            print(f"   Income: {response.get('total_income', 0)}, Expense: {response.get('total_expense', 0)}, Net: {response.get('net_flow', 0)}")
        return success

    def test_dashboard_filtered(self):
        """Test dashboard with filters"""
        if not self.account_id:
            print("⚠️  Skipping - No account ID available")
            return False
        
        success, response = self.run_test(
            "Get Dashboard (Filtered)",
            "GET",
            "dashboard",
            200,
            params={
                "account_id": self.account_id,
                "date_from": "2025-01-01",
                "date_to": "2025-01-31"
            }
        )
        if success:
            print(f"   Filtered - Income: {response.get('total_income', 0)}, Expense: {response.get('total_expense', 0)}")
        return success

    def test_duplicate_transaction(self):
        """Test duplicate transaction prevention"""
        if not self.account_id:
            print("⚠️  Skipping - No account ID available")
            return False
        
        # Try to create the same transaction again
        success, response = self.run_test(
            "Duplicate Transaction Prevention",
            "POST",
            "transactions",
            400,  # Should fail with 400
            data={
                "account_id": self.account_id,
                "date": "2025-01-15",
                "concept": "Test Income",
                "amount": 1000.50,
                "type": "income",
                "category_id": self.category_id
            }
        )
        return success

    def test_settings(self):
        """Test settings endpoint"""
        success, response = self.run_test(
            "Get Settings",
            "GET",
            "settings",
            200
        )
        if success:
            print(f"   Currency: {response.get('currency_symbol', '')}, Locale: {response.get('locale', '')}")
        return success

    # Cleanup methods
    def cleanup_rule(self):
        """Delete test rule"""
        if self.rule_id:
            self.run_test("Delete Rule", "DELETE", f"rules/{self.rule_id}", 200)

    def cleanup_subcategory(self):
        """Delete test subcategory"""
        if self.subcategory_id:
            self.run_test("Delete Subcategory", "DELETE", f"subcategories/{self.subcategory_id}", 200)

    def cleanup_category(self):
        """Delete test category"""
        if self.category_id:
            self.run_test("Delete Category", "DELETE", f"categories/{self.category_id}", 200)

    def cleanup_card(self):
        """Delete test card"""
        if self.card_id:
            self.run_test("Delete Card", "DELETE", f"credit-cards/{self.card_id}", 200)

    def cleanup_account(self):
        """Delete test account"""
        if self.account_id:
            self.run_test("Delete Account", "DELETE", f"accounts/{self.account_id}", 200)

def main():
    print("=" * 60)
    print("Finance Control API Testing")
    print("=" * 60)
    
    tester = FinanceAPITester()

    # Run tests in order
    print("\n📋 BASIC ENDPOINTS")
    tester.test_root()

    print("\n🏦 ACCOUNTS")
    tester.test_create_account()
    tester.test_get_accounts()

    print("\n💳 CREDIT CARDS")
    tester.test_create_credit_card()
    tester.test_get_credit_cards()

    print("\n📁 CATEGORIES")
    tester.test_create_category()
    tester.test_get_categories()

    print("\n📂 SUBCATEGORIES")
    tester.test_create_subcategory()
    tester.test_get_subcategories()

    print("\n⚙️  RULES")
    tester.test_create_rule()
    tester.test_get_rules()

    print("\n💰 TRANSACTIONS")
    tester.test_create_transaction()
    tester.test_get_transactions()
    tester.test_get_transactions_filtered()
    tester.test_update_transaction()
    tester.test_duplicate_transaction()

    print("\n💳 CARD TRANSACTIONS")
    tester.test_create_card_transaction()
    tester.test_get_card_transactions()
    tester.test_update_card_transaction()

    print("\n📊 DASHBOARD")
    tester.test_dashboard()
    tester.test_dashboard_filtered()

    print("\n⚙️  SETTINGS")
    tester.test_settings()

    print("\n🧹 CLEANUP")
    tester.cleanup_rule()
    tester.cleanup_subcategory()
    tester.cleanup_category()
    tester.cleanup_card()
    tester.cleanup_account()

    # Print results
    print("\n" + "=" * 60)
    print(f"📊 RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    print("=" * 60)
    
    # Calculate success rate
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    
    # Save results to JSON
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed": tester.tests_passed,
        "failed": tester.tests_run - tester.tests_passed,
        "success_rate": f"{success_rate:.1f}%",
        "test_details": tester.test_results
    }
    
    with open('/app/backend/test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend/test_results.json")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
