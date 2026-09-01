import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Trash2, Plus, Edit } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AccountsTab({ accounts, onCreate, onDelete }) {
  const [newAccount, setNewAccount] = useState({ name: '' });
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts]
  );

  const handleCreate = async () => {
    if (!newAccount.name) return;
    await onCreate(newAccount);
    setNewAccount({ name: '' });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Cuentas Bancarias</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            data-testid="account-name-input"
            placeholder="Nombre de la cuenta"
            value={newAccount.name}
            onChange={(e) => setNewAccount({ name: e.target.value })}
          />
          <Button data-testid="add-account-btn" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {sortedAccounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="font-medium">{acc.name}</span>
              <Button
                data-testid={`delete-account-${acc.id}`}
                onClick={() => onDelete(acc.id)}
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
  );
}

function CardsTab({ cards, onCreate, onDelete }) {
  const [newCard, setNewCard] = useState({ name: '', last4: '' });
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.name.localeCompare(b.name)),
    [cards]
  );

  const handleCreate = async () => {
    if (!newCard.name) return;
    await onCreate(newCard);
    setNewCard({ name: '', last4: '' });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Tarjetas de Crédito</CardTitle></CardHeader>
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
          <Button data-testid="add-card-btn" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {sortedCards.map((card) => (
            <div key={card.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="font-medium">{card.name} {card.last4 ? `(${card.last4})` : ''}</span>
              <Button
                data-testid={`delete-card-${card.id}`}
                onClick={() => onDelete(card.id)}
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
  );
}

function CategoriesTab({ categories, onCreate, onDelete, onEdit }) {
  const [newCategory, setNewCategory] = useState({ name: '' });
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const handleCreate = async () => {
    if (!newCategory.name) return;
    await onCreate(newCategory);
    setNewCategory({ name: '' });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Categorías</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            data-testid="category-name-input"
            placeholder="Nombre de la categoría"
            value={newCategory.name}
            onChange={(e) => setNewCategory({ name: e.target.value })}
          />
          <Button data-testid="add-category-btn" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {sortedCategories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="font-medium">{cat.name}</span>
              <div className="flex gap-2">
                <Button
                  data-testid={`edit-category-${cat.id}`}
                  onClick={() => onEdit(cat)}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  data-testid={`delete-category-${cat.id}`}
                  onClick={() => onDelete(cat.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SubcategoriesTab({ subcategories, categories, onCreate, onDelete, onEdit, getCategoryName }) {
  const [newSubcategory, setNewSubcategory] = useState({ category_id: '', name: '' });
  const sortedSubcategories = useMemo(
    () => [...subcategories].sort((a, b) => a.name.localeCompare(b.name)),
    [subcategories]
  );

  const handleCreate = async () => {
    if (!newSubcategory.name || !newSubcategory.category_id) return;
    await onCreate(newSubcategory);
    setNewSubcategory({ category_id: '', name: '' });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Subcategorías</CardTitle></CardHeader>
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
          <Button data-testid="add-subcategory-btn" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {sortedSubcategories.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <span className="font-medium">{sub.name}</span>
                <span className="text-sm text-gray-500 ml-2">({getCategoryName(sub.category_id)})</span>
              </div>
              <div className="flex gap-2">
                <Button
                  data-testid={`edit-subcategory-${sub.id}`}
                  onClick={() => onEdit(sub)}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  data-testid={`delete-subcategory-${sub.id}`}
                  onClick={() => onDelete(sub.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RulesTab({ rules, categories, subcategories, onCreate, onDelete, onEdit, getCategoryName }) {
  const [newRule, setNewRule] = useState({ source: 'bank', contains: '', sign: '', category_id: '', subcategory_id: '', priority: 0 });

  const handleCreate = async () => {
    if (!newRule.contains || !newRule.category_id) return;
    await onCreate(newRule);
    setNewRule({ source: 'bank', contains: '', sign: '', category_id: '', subcategory_id: '', priority: 0 });
  };

  const filteredSubs = useMemo(
    () => subcategories.filter((s) => s.category_id === newRule.category_id).sort((a, b) => a.name.localeCompare(b.name)),
    [subcategories, newRule.category_id]
  );

  return (
    <Card>
      <CardHeader><CardTitle>Reglas de Categorización</CardTitle></CardHeader>
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
          <Select value={newRule.sign || 'any'} onValueChange={(val) => setNewRule({ ...newRule, sign: val === 'any' ? '' : val })}>
            <SelectTrigger data-testid="rule-sign-select">
              <SelectValue placeholder="Signo (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Cualquiera</SelectItem>
              <SelectItem value="+">Positivo (+)</SelectItem>
              <SelectItem value="-">Negativo (-)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={newRule.category_id} onValueChange={(val) => setNewRule({ ...newRule, category_id: val, subcategory_id: '' })}>
            <SelectTrigger data-testid="rule-category-select">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {newRule.category_id && filteredSubs.length > 0 && (
            <Select value={newRule.subcategory_id || 'none'} onValueChange={(val) => setNewRule({ ...newRule, subcategory_id: val === 'none' ? '' : val })}>
              <SelectTrigger data-testid="rule-subcategory-select">
                <SelectValue placeholder="Subcategoría (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguna</SelectItem>
                {filteredSubs.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button data-testid="add-rule-btn" onClick={handleCreate} className="w-full">
          <Plus className="w-4 h-4 mr-1" /> Agregar Regla
        </Button>
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <span className="font-medium">{rule.contains}</span>
                <span className="text-sm text-gray-500 ml-2">→ {getCategoryName(rule.category_id)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  data-testid={`edit-rule-${rule.id}`}
                  onClick={() => onEdit(rule)}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  data-testid={`delete-rule-${rule.id}`}
                  onClick={() => onDelete(rule.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [rules, setRules] = useState([]);

  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editingRule, setEditingRule] = useState(null);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/accounts`);
      setAccounts(response.data);
    } catch (error) {
      toast.error('Error al cargar cuentas');
    }
  }, []);

  const loadCards = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/credit-cards`);
      setCards(response.data);
    } catch (error) {
      toast.error('Error al cargar tarjetas');
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error('Error al cargar categorías');
    }
  }, []);

  const loadSubcategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/subcategories`);
      setSubcategories(response.data);
    } catch (error) {
      toast.error('Error al cargar subcategorías');
    }
  }, []);

  const loadRules = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/rules`);
      setRules(response.data);
    } catch (error) {
      toast.error('Error al cargar reglas');
    }
  }, []);

  const loadAll = useCallback(() => {
    loadAccounts();
    loadCards();
    loadCategories();
    loadSubcategories();
    loadRules();
  }, [loadAccounts, loadCards, loadCategories, loadSubcategories, loadRules]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // CRUD wrappers
  const createAccount = async (data) => {
    try {
      await axios.post(`${API}/accounts`, data);
      toast.success('Cuenta creada');
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
  const createCard = async (data) => {
    try {
      await axios.post(`${API}/credit-cards`, data);
      toast.success('Tarjeta creada');
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
  const createCategory = async (data) => {
    try {
      await axios.post(`${API}/categories`, data);
      toast.success('Categoría creada');
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
  const createSubcategory = async (data) => {
    try {
      await axios.post(`${API}/subcategories`, data);
      toast.success('Subcategoría creada');
      loadSubcategories();
    } catch (error) {
      toast.error('Error al crear subcategoría');
    }
  };
  const updateSubcategory = async () => {
    if (!editingSubcategory || !editingSubcategory.name || !editingSubcategory.category_id) return;
    try {
      await axios.put(`${API}/subcategories/${editingSubcategory.id}`, {
        name: editingSubcategory.name,
        category_id: editingSubcategory.category_id,
      });
      toast.success('Subcategoría actualizada');
      setEditingSubcategory(null);
      loadSubcategories();
    } catch (error) {
      toast.error('Error al actualizar subcategoría');
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
  const createRule = async (data) => {
    try {
      const response = await axios.post(`${API}/rules`, data);
      const respData = response.data;
      if (respData.applied_to_existing > 0) {
        toast.success(`Regla creada y aplicada a ${respData.applied_to_existing} movimiento(s) existente(s)`);
      } else {
        toast.success('Regla creada (sin movimientos coincidentes)');
      }
      loadRules();
    } catch (error) {
      toast.error('Error al crear regla');
    }
  };
  const updateRule = async () => {
    if (!editingRule || !editingRule.contains || !editingRule.category_id) return;
    try {
      const response = await axios.put(`${API}/rules/${editingRule.id}`, {
        source: editingRule.source,
        contains: editingRule.contains,
        sign: editingRule.sign || null,
        category_id: editingRule.category_id,
        subcategory_id: editingRule.subcategory_id || null,
        priority: editingRule.priority,
        active: editingRule.active,
      });
      const data = response.data;
      if (data.applied_to_existing > 0) {
        toast.success(`Regla actualizada y aplicada a ${data.applied_to_existing} movimiento(s)`);
      } else {
        toast.success('Regla actualizada (sin movimientos coincidentes)');
      }
      setEditingRule(null);
      loadRules();
    } catch (error) {
      toast.error('Error al actualizar regla');
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

  const getCategoryName = useCallback((id) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : '';
  }, [categories]);

  const editingRuleFilteredSubs = useMemo(() => {
    if (!editingRule) return [];
    return subcategories
      .filter((s) => s.category_id === editingRule.category_id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [editingRule, subcategories]);

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

        <TabsContent value="accounts">
          <AccountsTab accounts={accounts} onCreate={createAccount} onDelete={deleteAccount} />
        </TabsContent>
        <TabsContent value="cards">
          <CardsTab cards={cards} onCreate={createCard} onDelete={deleteCard} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab
            categories={categories}
            onCreate={createCategory}
            onDelete={deleteCategory}
            onEdit={setEditingCategory}
          />
        </TabsContent>
        <TabsContent value="subcategories">
          <SubcategoriesTab
            subcategories={subcategories}
            categories={categories}
            onCreate={createSubcategory}
            onDelete={deleteSubcategory}
            onEdit={setEditingSubcategory}
            getCategoryName={getCategoryName}
          />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab
            rules={rules}
            categories={categories}
            subcategories={subcategories}
            onCreate={createRule}
            onDelete={deleteRule}
            onEdit={setEditingRule}
            getCategoryName={getCategoryName}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Category Dialog */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Categoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                data-testid="edit-category-name"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                placeholder="Nombre de la categoría"
              />
              <div className="flex gap-2">
                <Button onClick={() => setEditingCategory(null)} variant="outline" className="flex-1">
                  Cancelar
                </Button>
                <Button data-testid="save-category-btn" onClick={updateCategory} className="flex-1">
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Subcategory Dialog */}
      {editingSubcategory && (
        <Dialog open={!!editingSubcategory} onOpenChange={() => setEditingSubcategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Subcategoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Select
                value={editingSubcategory.category_id}
                onValueChange={(val) => setEditingSubcategory({ ...editingSubcategory, category_id: val })}
              >
                <SelectTrigger data-testid="edit-subcategory-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                data-testid="edit-subcategory-name"
                value={editingSubcategory.name}
                onChange={(e) => setEditingSubcategory({ ...editingSubcategory, name: e.target.value })}
                placeholder="Nombre de la subcategoría"
              />
              <div className="flex gap-2">
                <Button onClick={() => setEditingSubcategory(null)} variant="outline" className="flex-1">
                  Cancelar
                </Button>
                <Button data-testid="save-subcategory-btn" onClick={updateSubcategory} className="flex-1">
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Rule Dialog */}
      {editingRule && (
        <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Regla</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  value={editingRule.source}
                  onValueChange={(val) => setEditingRule({ ...editingRule, source: val })}
                >
                  <SelectTrigger data-testid="edit-rule-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Cuenta Bancaria</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  data-testid="edit-rule-contains"
                  value={editingRule.contains}
                  onChange={(e) => setEditingRule({ ...editingRule, contains: e.target.value })}
                  placeholder="Contiene texto..."
                />
                <Select
                  value={editingRule.sign || 'any'}
                  onValueChange={(val) => setEditingRule({ ...editingRule, sign: val === 'any' ? '' : val })}
                >
                  <SelectTrigger data-testid="edit-rule-sign"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquiera</SelectItem>
                    <SelectItem value="+">Positivo (+)</SelectItem>
                    <SelectItem value="-">Negativo (-)</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={editingRule.category_id}
                  onValueChange={(val) => setEditingRule({ ...editingRule, category_id: val, subcategory_id: '' })}
                >
                  <SelectTrigger data-testid="edit-rule-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingRule.category_id && editingRuleFilteredSubs.length > 0 && (
                  <Select
                    value={editingRule.subcategory_id || 'none'}
                    onValueChange={(val) => setEditingRule({ ...editingRule, subcategory_id: val === 'none' ? '' : val })}
                  >
                    <SelectTrigger data-testid="edit-rule-subcategory">
                      <SelectValue placeholder="Subcategoría (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      {editingRuleFilteredSubs.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setEditingRule(null)} variant="outline" className="flex-1">
                  Cancelar
                </Button>
                <Button data-testid="save-rule-btn" onClick={updateRule} className="flex-1">
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
