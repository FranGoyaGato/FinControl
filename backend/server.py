from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import hashlib
import io
import csv
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, Alignment, PatternFill, numbers
import xlrd
from decimal import Decimal
import re


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ============ MODELS ============

class Account(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str = 'bank'  # 'bank'
    currency: str = 'EUR'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AccountCreate(BaseModel):
    name: str
    type: str = 'bank'
    currency: str = 'EUR'

class CreditCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    last4: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreditCardCreate(BaseModel):
    name: str
    last4: Optional[str] = None

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str

class CategoryCreate(BaseModel):
    name: str

class Subcategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    name: str

class SubcategoryCreate(BaseModel):
    category_id: str
    name: str

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str
    date: str  # ISO format YYYY-MM-DD
    concept: str
    amount: float
    type: str  # 'income' or 'expense'
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    dedup_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    account_id: str
    date: str
    concept: str
    amount: float
    type: str
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

class CardTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    card_id: str
    date: str  # ISO format YYYY-MM-DD
    concept: str
    amount: float
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    dedup_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CardTransactionCreate(BaseModel):
    card_id: str
    date: str
    concept: str
    amount: float
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

class Rule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str  # 'bank' or 'card'
    contains: str  # text pattern
    sign: Optional[str] = None  # '+' or '-' or null
    category_id: str
    subcategory_id: Optional[str] = None
    priority: int = 0
    active: bool = True

class RuleCreate(BaseModel):
    source: str
    contains: str
    sign: Optional[str] = None
    category_id: str
    subcategory_id: Optional[str] = None
    priority: int = 0
    active: bool = True

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    currency_symbol: str = '€'
    locale: str = 'es-ES'

class SettingsUpdate(BaseModel):
    currency_symbol: str = '€'
    locale: str = 'es-ES'


# ============ HELPER FUNCTIONS ============

def generate_dedup_hash(identifier: str, date: str, concept: str, amount: float) -> str:
    """Generate SHA1 hash for deduplication"""
    raw = f"{identifier}|{date}|{concept}|{amount}"
    return hashlib.sha1(raw.encode()).hexdigest()

def normalize_date(date_str: str) -> str:
    """Convert DD/MM/YYYY to YYYY-MM-DD"""
    if '/' in date_str:
        parts = date_str.strip().split('/')
        if len(parts) == 3:
            day, month, year = parts
            return f"{year.zfill(4)}-{month.zfill(2)}-{day.zfill(2)}"
    return date_str

def detect_separator(content: str) -> str:
    """Detect CSV separator (comma or semicolon)"""
    first_line = content.split('\n')[0]
    if ';' in first_line:
        return ';'
    return ','

async def apply_rules(concept: str, amount: float, source: str) -> tuple:
    """Apply categorization rules. Returns (category_id, subcategory_id)"""
    rules = await db.rules.find({
        'source': source,
        'active': True
    }).sort('priority', -1).to_list(1000)
    
    for rule in rules:
        if rule['contains'].lower() in concept.lower():
            # Check sign if specified
            if rule.get('sign'):
                if rule['sign'] == '+' and amount <= 0:
                    continue
                if rule['sign'] == '-' and amount >= 0:
                    continue
            return (rule['category_id'], rule.get('subcategory_id'))
    
    return (None, None)

def format_currency_es(value: float) -> str:
    """Format number as EUR es-ES"""
    formatted = f"{value:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    return f"{formatted} €"


# ============ ROUTES ============

@api_router.get("/")
async def root():
    return {"message": "Finance Control API"}


# --- ACCOUNTS ---
@api_router.post("/accounts", response_model=Account)
async def create_account(input: AccountCreate):
    account = Account(**input.model_dump())
    doc = account.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.accounts.insert_one(doc)
    return account

@api_router.get("/accounts", response_model=List[Account])
async def get_accounts():
    accounts = await db.accounts.find({}, {"_id": 0}).to_list(1000)
    for acc in accounts:
        if isinstance(acc.get('created_at'), str):
            acc['created_at'] = datetime.fromisoformat(acc['created_at'])
    return accounts

@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    result = await db.accounts.delete_one({"id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    # Also delete associated transactions
    await db.transactions.delete_many({"account_id": account_id})
    return {"message": "Account deleted"}


# --- CREDIT CARDS ---
@api_router.post("/credit-cards", response_model=CreditCard)
async def create_credit_card(input: CreditCardCreate):
    card = CreditCard(**input.model_dump())
    doc = card.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.credit_cards.insert_one(doc)
    return card

@api_router.get("/credit-cards", response_model=List[CreditCard])
async def get_credit_cards():
    cards = await db.credit_cards.find({}, {"_id": 0}).to_list(1000)
    for card in cards:
        if isinstance(card.get('created_at'), str):
            card['created_at'] = datetime.fromisoformat(card['created_at'])
    return cards

@api_router.delete("/credit-cards/{card_id}")
async def delete_credit_card(card_id: str):
    result = await db.credit_cards.delete_one({"id": card_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    # Also delete associated transactions
    await db.card_transactions.delete_many({"card_id": card_id})
    return {"message": "Card deleted"}


# --- CATEGORIES ---
@api_router.post("/categories", response_model=Category)
async def create_category(input: CategoryCreate):
    category = Category(**input.model_dump())
    await db.categories.insert_one(category.model_dump())
    return category

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return categories

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, input: CategoryCreate):
    result = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.categories.update_one({"id": category_id}, {"$set": {"name": input.name}})
    result['name'] = input.name
    return Category(**result)

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    # Also delete subcategories
    await db.subcategories.delete_many({"category_id": category_id})
    return {"message": "Category deleted"}


# --- SUBCATEGORIES ---
@api_router.post("/subcategories", response_model=Subcategory)
async def create_subcategory(input: SubcategoryCreate):
    subcategory = Subcategory(**input.model_dump())
    await db.subcategories.insert_one(subcategory.model_dump())
    return subcategory

@api_router.get("/subcategories", response_model=List[Subcategory])
async def get_subcategories(category_id: Optional[str] = None):
    query = {"category_id": category_id} if category_id else {}
    subcategories = await db.subcategories.find(query, {"_id": 0}).to_list(1000)
    return subcategories

@api_router.put("/subcategories/{subcategory_id}", response_model=Subcategory)
async def update_subcategory(subcategory_id: str, input: SubcategoryCreate):
    result = await db.subcategories.find_one({"id": subcategory_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    await db.subcategories.update_one(
        {"id": subcategory_id}, 
        {"$set": {"name": input.name, "category_id": input.category_id}}
    )
    result['name'] = input.name
    result['category_id'] = input.category_id
    return Subcategory(**result)

@api_router.delete("/subcategories/{subcategory_id}")
async def delete_subcategory(subcategory_id: str):
    result = await db.subcategories.delete_one({"id": subcategory_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    return {"message": "Subcategory deleted"}


# --- RULES ---
@api_router.post("/rules", response_model=Rule)
async def create_rule(input: RuleCreate):
    rule = Rule(**input.model_dump())
    await db.rules.insert_one(rule.model_dump())
    return rule

@api_router.get("/rules", response_model=List[Rule])
async def get_rules():
    rules = await db.rules.find({}, {"_id": 0}).sort('priority', -1).to_list(1000)
    return rules

@api_router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    result = await db.rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deleted"}

@api_router.put("/rules/{rule_id}", response_model=Rule)
async def update_rule(rule_id: str, input: RuleCreate):
    result = await db.rules.find_one({"id": rule_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    updated_data = input.model_dump()
    updated_data['id'] = rule_id
    await db.rules.replace_one({"id": rule_id}, updated_data)
    return Rule(**updated_data)


# --- TRANSACTIONS ---
@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(input: TransactionCreate):
    dedup_hash = generate_dedup_hash(input.account_id, input.date, input.concept, input.amount)
    
    # Check for duplicates
    existing = await db.transactions.find_one({"dedup_hash": dedup_hash})
    if existing:
        raise HTTPException(status_code=400, detail="Duplicate transaction")
    
    transaction = Transaction(**input.model_dump(), dedup_hash=dedup_hash)
    doc = transaction.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.transactions.insert_one(doc)
    return transaction

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    account_id: Optional[str] = None,
    type: Optional[str] = None,
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    query = {}
    if account_id:
        query['account_id'] = account_id
    if type:
        query['type'] = type
    if category_id:
        query['category_id'] = category_id
    if subcategory_id:
        query['subcategory_id'] = subcategory_id
    if date_from:
        query.setdefault('date', {})['$gte'] = date_from
    if date_to:
        query.setdefault('date', {})['$lte'] = date_to
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort('date', -1).to_list(10000)
    for tx in transactions:
        if isinstance(tx.get('created_at'), str):
            tx['created_at'] = datetime.fromisoformat(tx['created_at'])
    return transactions

@api_router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, category_id: Optional[str] = None, subcategory_id: Optional[str] = None):
    result = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = {}
    if category_id is not None:
        update_data['category_id'] = category_id
    if subcategory_id is not None:
        update_data['subcategory_id'] = subcategory_id
    
    await db.transactions.update_one({"id": transaction_id}, {"$set": update_data})
    result.update(update_data)
    if isinstance(result.get('created_at'), str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    return Transaction(**result)


# --- CARD TRANSACTIONS ---
@api_router.post("/card-transactions", response_model=CardTransaction)
async def create_card_transaction(input: CardTransactionCreate):
    dedup_hash = generate_dedup_hash(input.card_id, input.date, input.concept, input.amount)
    
    # Check for duplicates
    existing = await db.card_transactions.find_one({"dedup_hash": dedup_hash})
    if existing:
        raise HTTPException(status_code=400, detail="Duplicate transaction")
    
    transaction = CardTransaction(**input.model_dump(), dedup_hash=dedup_hash)
    doc = transaction.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.card_transactions.insert_one(doc)
    return transaction

@api_router.get("/card-transactions", response_model=List[CardTransaction])
async def get_card_transactions(
    card_id: Optional[str] = None,
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    query = {}
    if card_id:
        query['card_id'] = card_id
    if category_id:
        query['category_id'] = category_id
    if subcategory_id:
        query['subcategory_id'] = subcategory_id
    if date_from:
        query.setdefault('date', {})['$gte'] = date_from
    if date_to:
        query.setdefault('date', {})['$lte'] = date_to
    
    transactions = await db.card_transactions.find(query, {"_id": 0}).sort('date', -1).to_list(10000)
    for tx in transactions:
        if isinstance(tx.get('created_at'), str):
            tx['created_at'] = datetime.fromisoformat(tx['created_at'])
    return transactions

@api_router.put("/card-transactions/{transaction_id}", response_model=CardTransaction)
async def update_card_transaction(transaction_id: str, category_id: Optional[str] = None, subcategory_id: Optional[str] = None):
    result = await db.card_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = {}
    if category_id is not None:
        update_data['category_id'] = category_id
    if subcategory_id is not None:
        update_data['subcategory_id'] = subcategory_id
    
    await db.card_transactions.update_one({"id": transaction_id}, {"$set": update_data})
    result.update(update_data)
    if isinstance(result.get('created_at'), str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    return CardTransaction(**result)


# --- IMPORT CSV/XLSX ---
@api_router.post("/import/parse-csv")
async def parse_csv(file: UploadFile = File(...), import_type: str = Query(...), entity_id: str = Query(...)):
    """Parse CSV or XLSX and return preview with auto-categorization"""
    content = await file.read()
    filename = file.filename.lower()
    
    rows = []
    detected_columns = []
    
    # Detect file type and parse accordingly
    if filename.endswith('.xlsx'):
        # Parse XLSX (Excel 2007+)
        try:
            wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            
            # Get header row (first row)
            headers = [cell.value.strip().lower() if cell.value else '' for cell in ws[1]]
            detected_columns = headers.copy()
            
            # Get data rows - map by position: A=fecha, C=concepto, D=importe
            for row in ws.iter_rows(min_row=2, values_only=True):
                if not row:
                    continue
                
                # Ensure we have at least 4 columns, pad with None if needed
                row_list = list(row) + [None] * (4 - len(row))
                
                # Skip if all relevant columns are empty
                if not row_list[0] and not row_list[2] and not row_list[3]:
                    continue
                
                # Handle date - might be datetime object from Excel
                fecha_val = row_list[0]
                if isinstance(fecha_val, datetime):
                    fecha_str = fecha_val.strftime('%d/%m/%Y')
                else:
                    fecha_str = str(fecha_val).strip() if fecha_val is not None else ''
                
                row_dict = {
                    'fecha': fecha_str,
                    'concepto': str(row_list[2]).strip() if row_list[2] is not None else '',
                    'importe': str(row_list[3]) if row_list[3] is not None else '0'
                }
                rows.append(row_dict)
            
            wb.close()
        except Exception as e:
            logging.error(f"Error parsing XLSX: {e}")
            raise HTTPException(status_code=400, detail=f"Error al procesar archivo XLSX: {str(e)}")
    
    elif filename.endswith('.xls'):
        # Parse XLS (Excel 97-2003)
        try:
            wb = xlrd.open_workbook(file_contents=content)
            ws = wb.sheet_by_index(0)
            
            # Get header row (first row)
            headers = [str(cell.value).strip().lower() if cell.value else '' for cell in ws.row(0)]
            detected_columns = headers.copy()
            
            # Get data rows - map by position: A=fecha, C=concepto, D=importe
            for row_idx in range(1, ws.nrows):
                # Check if we have enough columns
                if ws.ncols < 2:  # At least need 2 columns
                    continue
                
                # Column A (index 0) = fecha
                fecha_val = ''
                if ws.ncols > 0:
                    fecha_cell = ws.cell(row_idx, 0)
                    if fecha_cell.ctype == xlrd.XL_CELL_DATE:
                        date_tuple = xlrd.xldate_as_tuple(fecha_cell.value, wb.datemode)
                        fecha_val = f"{date_tuple[2]:02d}/{date_tuple[1]:02d}/{date_tuple[0]}"
                    else:
                        fecha_val = str(fecha_cell.value).strip() if fecha_cell.value else ''
                
                # Column C (index 2) = concepto
                concepto_val = ''
                if ws.ncols > 2:
                    concepto_cell = ws.cell(row_idx, 2)
                    concepto_val = str(concepto_cell.value).strip() if concepto_cell.value else ''
                
                # Column D (index 3) = importe
                importe_val = '0'
                if ws.ncols > 3:
                    importe_cell = ws.cell(row_idx, 3)
                    importe_val = str(importe_cell.value) if importe_cell.value else '0'
                
                # Skip if all relevant columns are empty
                if not fecha_val and not concepto_val and importe_val == '0':
                    continue
                
                row_dict = {
                    'fecha': fecha_val,
                    'concepto': concepto_val,
                    'importe': importe_val
                }
                rows.append(row_dict)
            
        except Exception as e:
            logging.error(f"Error parsing XLS: {e}")
            raise HTTPException(status_code=400, detail=f"Error al procesar archivo XLS: {str(e)}")
    
    elif filename.endswith('.csv'):
        # Parse CSV
        try:
            text_content = content.decode('utf-8')
            separator = detect_separator(text_content)
            reader = csv.DictReader(io.StringIO(text_content), delimiter=separator)
            
            for row in reader:
                # Normalize column names (lowercase, strip)
                row_dict = {k.strip().lower(): v.strip() for k, v in row.items()}
                rows.append(row_dict)
        except Exception as e:
            logging.error(f"Error parsing CSV: {e}")
            raise HTTPException(status_code=400, detail=f"Error al procesar archivo CSV: {str(e)}")
    
    else:
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Use .csv, .xls o .xlsx")
    
    # Process rows
    preview = []
    
    for row in rows:
        if import_type == 'account':
            # Direct mapping - columns already mapped by position
            date_raw = row.get('fecha', '')
            concept = row.get('concepto', '')
            amount_str = row.get('importe', '0')
            
            date = normalize_date(date_raw)
            
            # Parse amount - handle both CSV (1.234,56) and Excel (1234.56) formats
            try:
                # Check if it's already a float (from Excel) or needs parsing (from CSV)
                if ',' in amount_str and '.' in amount_str:
                    # CSV format: 1.234,56 -> remove thousands separator, replace decimal
                    amount_str = amount_str.replace('.', '').replace(',', '.')
                elif ',' in amount_str:
                    # Only comma: 1234,56 -> replace decimal separator
                    amount_str = amount_str.replace(',', '.')
                # else: Excel format or no separators - use as is
                
                amount = float(amount_str)
            except:
                amount = 0.0
            
            tx_type = 'income' if amount > 0 else 'expense'
            category_id, subcategory_id = await apply_rules(concept, amount, 'bank')
            
            preview.append({
                'date': date,
                'concept': concept,
                'amount': amount,
                'type': tx_type,
                'category_id': category_id,
                'subcategory_id': subcategory_id
            })
        
        elif import_type == 'card':
            # Direct mapping - columns already mapped by position
            date_raw = row.get('fecha', '')
            concept = row.get('concepto', '')
            amount_str = row.get('importe', '0')
            
            date = normalize_date(date_raw)
            
            # Parse amount - handle both CSV and Excel formats
            try:
                if ',' in amount_str and '.' in amount_str:
                    amount_str = amount_str.replace('.', '').replace(',', '.')
                elif ',' in amount_str:
                    amount_str = amount_str.replace(',', '.')
                
                amount = float(amount_str)
            except:
                amount = 0.0
            
            category_id, subcategory_id = await apply_rules(concept, amount, 'card')
            
            preview.append({
                'date': date,
                'concept': concept,
                'amount': amount,
                'category_id': category_id,
                'subcategory_id': subcategory_id
            })
    
    return {
        'preview': preview,
        'count': len(preview),
        'entity_id': entity_id,
        'import_type': import_type,
        'detected_columns': detected_columns
    }

@api_router.post("/import/confirm")
async def confirm_import(data: Dict[str, Any]):
    """Confirm and save transactions from preview"""
    import_type = data.get('import_type')
    entity_id = data.get('entity_id')
    transactions = data.get('transactions', [])
    
    inserted = 0
    duplicates = 0
    errors = 0
    
    for tx in transactions:
        try:
            if import_type == 'account':
                dedup_hash = generate_dedup_hash(entity_id, tx['date'], tx['concept'], tx['amount'])
                existing = await db.transactions.find_one({"dedup_hash": dedup_hash})
                if existing:
                    duplicates += 1
                    continue
                
                transaction = Transaction(
                    account_id=entity_id,
                    date=tx['date'],
                    concept=tx['concept'],
                    amount=tx['amount'],
                    type=tx['type'],
                    category_id=tx.get('category_id'),
                    subcategory_id=tx.get('subcategory_id'),
                    dedup_hash=dedup_hash
                )
                doc = transaction.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.transactions.insert_one(doc)
                inserted += 1
            
            elif import_type == 'card':
                dedup_hash = generate_dedup_hash(entity_id, tx['date'], tx['concept'], tx['amount'])
                existing = await db.card_transactions.find_one({"dedup_hash": dedup_hash})
                if existing:
                    duplicates += 1
                    continue
                
                transaction = CardTransaction(
                    card_id=entity_id,
                    date=tx['date'],
                    concept=tx['concept'],
                    amount=tx['amount'],
                    category_id=tx.get('category_id'),
                    subcategory_id=tx.get('subcategory_id'),
                    dedup_hash=dedup_hash
                )
                doc = transaction.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.card_transactions.insert_one(doc)
                inserted += 1
        except Exception as e:
            errors += 1
            logging.error(f"Error importing transaction: {e}")
    
    return {
        'inserted': inserted,
        'duplicates': duplicates,
        'errors': errors
    }


# --- DASHBOARD ---
@api_router.get("/dashboard")
async def get_dashboard(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    account_id: Optional[str] = None,
    type: Optional[str] = None,
    category_id: Optional[str] = None
):
    """Get dashboard KPIs"""
    query = {}
    if account_id:
        query['account_id'] = account_id
    if type:
        query['type'] = type
    if category_id:
        query['category_id'] = category_id
    if date_from:
        query.setdefault('date', {})['$gte'] = date_from
    if date_to:
        query.setdefault('date', {})['$lte'] = date_to
    
    transactions = await db.transactions.find(query, {"_id": 0}).to_list(10000)
    
    total_income = sum(tx['amount'] for tx in transactions if tx['type'] == 'income')
    total_expense = sum(abs(tx['amount']) for tx in transactions if tx['type'] == 'expense')
    net_flow = total_income - total_expense
    
    return {
        'total_income': total_income,
        'total_expense': total_expense,
        'net_flow': net_flow,
        'transaction_count': len(transactions)
    }


# --- SETTINGS ---
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        # Create default settings
        default = Settings()
        await db.settings.insert_one(default.model_dump())
        return default
    return Settings(**settings)

@api_router.put("/settings", response_model=Settings)
async def update_settings(input: SettingsUpdate):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        new_settings = Settings(**input.model_dump())
        await db.settings.insert_one(new_settings.model_dump())
        return new_settings
    
    await db.settings.update_one({}, {"$set": input.model_dump()})
    settings.update(input.model_dump())
    return Settings(**settings)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
