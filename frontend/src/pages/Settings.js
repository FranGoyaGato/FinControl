import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Trash2, Plus, Edit } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newAccount, setNewAccount] = useState({ name: '' });
  const [newCard, setNewCard] = useState({ name: '', last4: '' });
  const [newCategory, setNewCategory] = useState({ name: '' });
  const [newSubcategory, setNewSubcategory] = useState({ category_id: '', name: '' });
  const [newRule, setNewRule] = useState({ source: 'bank', contains: '', sign: '', category_id: '', priority: 0 });
  
  // Edit states
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = () => {
    loadAccounts();
    loadCards();
    loadCategories();
    loadSubcategories();
    loadRules();
  };

  const loadAccounts = async () => {
    try {
      const response = await axios.get(`${API}/accounts`);
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadCards = async () => {
    try {
      const response = await axios.get(`${API}/credit-cards`);
      setCards(response.data);
    } catch (error) {
      console.error('Error loading cards:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSubcategories = async () => {
    try {
      const response = await axios.get(`${API}/subcategories`);
      setSubcategories(response.data);
    } catch (error) {
      console.error('Error loading subcategories:', error);
    }
  };

  const loadRules = async () => {
    try {
      const response = await axios.get(`${API}/rules`);
      setRules(response.data);
    } catch (error) {
      console.error('Error loading rules:', error);
    }
  };

  // CRUD Operations
  const createAccount = async () => {
    if (!newAccount.name) return;
    try {
      await axios.post(`${API}/accounts`, newAccount);
      toast.success('Cuenta creada');
      setNewAccount({ name: '' });
      loadAccounts();
    } catch (error) {
      toast.error('Error al crear cuenta');
    }
  };

  const deleteAccount = async (id) => {
    try {
      await axios.delete(`${API}/accounts/${id}`);
      toast.success('Cuenta eliminada');
      loadAccounts();
    } catch (error) {
      toast.error('Error al eliminar cuenta');
    }
  };

  const createCard = async () => {
    if (!newCard.name) return;
    try {
      await axios.post(`${API}/credit-cards`, newCard);
      toast.success('Tarjeta creada');
      setNewCard({ name: '', last4: '' });
      loadCards();
    } catch (error) {
      toast.error('Error al crear tarjeta');
    }
  };

  const deleteCard = async (id) => {
    try {
      await axios.delete(`${API}/credit-cards/${id}`);
      toast.success('Tarjeta eliminada');
      loadCards();
    } catch (error) {
      toast.error('Error al eliminar tarjeta');
    }
  };

  const createCategory = async () => {
    if (!newCategory.name) return;
    try {
      await axios.post(`${API}/categories`, newCategory);
      toast.success('Categoría creada');
      setNewCategory({ name: '' });
      loadCategories();
    } catch (error) {
      toast.error('Error al crear categoría');
    }
  };

  const updateCategory = async () => {
    if (!editingCategory || !editingCategory.name) return;
    try {
      await axios.put(`${API}/categories/${editingCategory.id}`, { name: editingCategory.name });
      toast.success('Categoría actualizada');
      setEditingCategory(null);
      loadCategories();
    } catch (error) {
      toast.error('Error al actualizar categoría');
    }
  };

  const deleteCategory = async (id) => {
    try {
      await axios.delete(`${API}/categories/${id}`);
      toast.success('Categoría eliminada');
      loadCategories();
      loadSubcategories();
    } catch (error) {
      toast.error('Error al eliminar categoría');
    }
  };

  const createSubcategory = async () => {
    if (!newSubcategory.name || !newSubcategory.category_id) return;
    try {
      await axios.post(`${API}/subcategories`, newSubcategory);
      toast.success('Subcategoría creada');
      setNewSubcategory({ category_id: '', name: '' });
      loadSubcategories();
    } catch (error) {
      toast.error('Error al crear subcategoría');
    }
  };

  const deleteSubcategory = async (id) => {
    try {
      await axios.delete(`${API}/subcategories/${id}`);
      toast.success('Subcategoría eliminada');
      loadSubcategories();
    } catch (error) {
      toast.error('Error al eliminar subcategoría');
    }
  };

  const createRule = async () => {
    if (!newRule.contains || !newRule.category_id) return;
    try {
      await axios.post(`${API}/rules`, newRule);
      toast.success('Regla creada');
      setNewRule({ source: 'bank', contains: '', sign: '', category_id: '', priority: 0 });
      loadRules();
    } catch (error) {
      toast.error('Error al crear regla');
    }
  };

  const deleteRule = async (id) => {
    try {
      await axios.delete(`${API}/rules/${id}`);
      toast.success('Regla eliminada');
      loadRules();
    } catch (error) {
      toast.error('Error al eliminar regla');
    }
  };

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          <SettingsIcon className="w-8 h-8 text-gray-700" />
          Configuración
        </h1>
        <p className="text-gray-600 mt-1">Administra tus cuentas, categorías y reglas</p>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger data-testid="tab-accounts" value="accounts">Cuentas</TabsTrigger>
          <TabsTrigger data-testid="tab-cards" value="cards">Tarjetas</TabsTrigger>
          <TabsTrigger data-testid="tab-categories" value="categories">Categorías</TabsTrigger>
          <TabsTrigger data-testid="tab-subcategories" value="subcategories">Subcategorías</TabsTrigger>
          <TabsTrigger data-testid="tab-rules" value="rules">Reglas</TabsTrigger>
        </TabsList>

        {/* Accounts */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>Cuentas Bancarias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  data-testid="account-name-input"
                  placeholder="Nombre de la cuenta"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ name: e.target.value })}
                />
                <Button data-testid="add-account-btn" onClick={createAccount}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {accounts.sort((a, b) => a.name.localeCompare(b.name)).map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="font-medium">{acc.name}</span>
                    <Button
                      data-testid={`delete-account-${acc.id}`}
                      onClick={() => deleteAccount(acc.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cards */}
        <TabsContent value="cards">
          <Card>
            <CardHeader>
              <CardTitle>Tarjetas de Crédito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  data-testid="card-name-input"
                  placeholder="Nombre de la tarjeta"
                  value={newCard.name}
                  onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                />
                <Input
                  data-testid="card-last4-input"
                  placeholder="Últimos 4 dígitos"
                  value={newCard.last4}
                  onChange={(e) => setNewCard({ ...newCard, last4: e.target.value })}
                  maxLength={4}
                  className="max-w-[150px]"
                />
                <Button data-testid="add-card-btn" onClick={createCard}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {cards.sort((a, b) => a.name.localeCompare(b.name)).map((card) => (
                  <div key={card.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="font-medium">{card.name} {card.last4 ? `(${card.last4})` : ''}</span>
                    <Button
                      data-testid={`delete-card-${card.id}`}
                      onClick={() => deleteCard(card.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Categorías</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  data-testid="category-name-input"
                  placeholder="Nombre de la categoría"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ name: e.target.value })}
                />
                <Button data-testid="add-category-btn" onClick={createCategory}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {categories.sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="font-medium">{cat.name}</span>
                    <Button
                      data-testid={`delete-category-${cat.id}`}
                      onClick={() => deleteCategory(cat.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subcategories */}
        <TabsContent value="subcategories">
          <Card>
            <CardHeader>
              <CardTitle>Subcategorías</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select
                  value={newSubcategory.category_id}
                  onValueChange={(val) => setNewSubcategory({ ...newSubcategory, category_id: val })}
                >
                  <SelectTrigger data-testid="subcategory-category-select">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  data-testid="subcategory-name-input"
                  placeholder="Nombre de la subcategoría"
                  value={newSubcategory.name}
                  onChange={(e) => setNewSubcategory({ ...newSubcategory, name: e.target.value })}
                />
                <Button data-testid="add-subcategory-btn" onClick={createSubcategory}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {subcategories.sort((a, b) => a.name.localeCompare(b.name)).map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <span className="font-medium">{sub.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({getCategoryName(sub.category_id)})</span>
                    </div>
                    <Button
                      data-testid={`delete-subcategory-${sub.id}`}
                      onClick={() => deleteSubcategory(sub.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Reglas de Categorización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Select value={newRule.source} onValueChange={(val) => setNewRule({ ...newRule, source: val })}>
                  <SelectTrigger data-testid="rule-source-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Cuenta Bancaria</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  data-testid="rule-contains-input"
                  placeholder="Contiene texto..."
                  value={newRule.contains}
                  onChange={(e) => setNewRule({ ...newRule, contains: e.target.value })}
                />
                <Select value={newRule.sign || "any"} onValueChange={(val) => setNewRule({ ...newRule, sign: val === "any" ? "" : val })}>
                  <SelectTrigger data-testid="rule-sign-select">
                    <SelectValue placeholder="Signo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquiera</SelectItem>
                    <SelectItem value="+">Positivo (+)</SelectItem>
                    <SelectItem value="-">Negativo (-)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newRule.category_id} onValueChange={(val) => setNewRule({ ...newRule, category_id: val })}>
                  <SelectTrigger data-testid="rule-category-select">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button data-testid="add-rule-btn" onClick={createRule} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Agregar Regla
              </Button>
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <span className="font-medium">{rule.contains}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        → {getCategoryName(rule.category_id)}
                      </span>
                    </div>
                    <Button
                      data-testid={`delete-rule-${rule.id}`}
                      onClick={() => deleteRule(rule.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
