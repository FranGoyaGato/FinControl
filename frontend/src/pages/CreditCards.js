import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditCard, Search, X } from 'lucide-react';
import { formatCurrencyEUR } from '../utils/format';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CreditCards() {
  const [transactions, setTransactions] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('concept'); // 'concept' or 'category'
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCards = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/credit-cards`);
      setCards(response.data);
      if (response.data.length > 0) {
        setSelectedCard((prev) => prev || response.data[0].id);
      }
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

  const loadTransactions = useCallback(async () => {
    if (!selectedCard) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API}/card-transactions`, {
        params: { card_id: selectedCard },
      });
      setTransactions(response.data);
    } catch (error) {
      toast.error('Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  }, [selectedCard]);

  useEffect(() => {
    loadCards();
    loadCategories();
  }, [loadCards, loadCategories]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const getCategoryName = useCallback((id) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : 'Sin categoría';
  }, [categories]);

  const updateTransactionCategory = async (txId, categoryId) => {    try {
      const tx = transactions.find((t) => t.id === txId);

      if (tx && categoryId) {
        const sameConcept = transactions.filter((t) => t.concept === tx.concept);
        const updatePromises = sameConcept.map((t) =>
          axios.put(`${API}/card-transactions/${t.id}`, null, {
            params: { category_id: categoryId },
          })
        );
        await Promise.all(updatePromises);

        try {
          await axios.post(`${API}/rules`, {
            source: 'card',
            contains: tx.concept,
            sign: null,
            category_id: categoryId,
            subcategory_id: null,
            priority: 5,
            active: true,
          });
          toast.success(`Categoría aplicada a ${sameConcept.length} movimiento(s) y regla creada`);
        } catch (ruleError) {
          toast.success(`Categoría aplicada a ${sameConcept.length} movimiento(s)`);
        }
      } else {
        await axios.put(`${API}/card-transactions/${txId}`, null, {
          params: { category_id: categoryId },
        });
        toast.success('Categoría actualizada');
      }

      loadTransactions();
    } catch (error) {
      toast.error('Error al actualizar categoría');
    }
  };

  const clearTransactionCategory = async (txId) => {
    try {
      await axios.put(`${API}/card-transactions/${txId}`, null, {
        params: { clear_category: true },
      });
      toast.success('Categoría eliminada');
      loadTransactions();
    } catch (error) {
      toast.error('Error al quitar categoría');
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      let matchesCategory = true;
      if (selectedCategoryFilter === 'uncategorized') {
        matchesCategory = !tx.category_id || tx.category_id === '';
      } else if (selectedCategoryFilter) {
        matchesCategory = tx.category_id === selectedCategoryFilter;
      }

      let matchesSearch = true;
      if (searchTerm) {
        if (searchType === 'concept') {
          matchesSearch = tx.concept.toLowerCase().includes(searchTerm.toLowerCase());
        } else if (searchType === 'category') {
          const catName = getCategoryName(tx.category_id);
          matchesSearch = catName.toLowerCase().includes(searchTerm.toLowerCase());
        }
      }
      return matchesCategory && matchesSearch;
    });
  }, [transactions, selectedCategoryFilter, searchTerm, searchType, getCategoryName]);

  const totalAmount = useMemo(
    () => filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [filteredTransactions]
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          <CreditCard className="w-8 h-8 text-indigo-600" />
          Tarjetas de Crédito
        </h1>
        <p className="text-gray-600 mt-1">Gestiona tus movimientos de tarjetas</p>
      </div>

      {cards.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="pt-6 text-center py-12">
            <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">No hay tarjetas configuradas</p>
            <p className="text-sm text-gray-400">Ve a Configuración para agregar tarjetas</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Tarjeta:</label>
                <Select value={selectedCard} onValueChange={setSelectedCard}>
                  <SelectTrigger data-testid="card-select" className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name} {card.last4 ? `(${card.last4})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Total Movimientos</div>
              <div className={`text-3xl font-bold ${totalAmount < 0 ? 'text-red-700' : 'text-blue-700'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {formatCurrencyEUR(totalAmount)}
              </div>
              <div className="text-sm text-gray-600 mt-2">{filteredTransactions.length} transacciones</div>
            </CardContent>
          </Card>

          <Card data-testid="card-filters" className="border border-gray-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Filtrar por categoría</label>
                  <Select value={selectedCategoryFilter || 'all'} onValueChange={(val) => setSelectedCategoryFilter(val === 'all' ? '' : val)}>
                    <SelectTrigger data-testid="category-filter-select-cards">
                      <SelectValue placeholder="Todas las categorías" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      <SelectItem value="uncategorized">Sin categoría</SelectItem>
                      {sortedCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-search" className="border border-gray-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={searchType} onValueChange={setSearchType}>
                  <SelectTrigger data-testid="search-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concept">Buscar por Concepto</SelectItem>
                    <SelectItem value="category">Buscar por Categoría</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    data-testid="search-card-transactions-input"
                    type="text"
                    placeholder={searchType === 'concept' ? 'Buscar por concepto...' : 'Buscar por categoría...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-transactions-table" className="border border-gray-200">
            <CardHeader>
              <CardTitle>Transacciones</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay movimientos registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 text-sm font-semibold text-gray-600">Fecha</th>
                        <th className="pb-3 text-sm font-semibold text-gray-600">Concepto</th>
                        <th className="pb-3 text-sm font-semibold text-gray-600">Importe</th>
                        <th className="pb-3 text-sm font-semibold text-gray-600">Categoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx) => (
                        <tr key={tx.id} data-testid={`card-tx-row-${tx.id}`} className="border-b border-gray-100">
                          <td className="py-3 text-sm">{new Date(tx.date).toLocaleDateString('es-ES')}</td>
                          <td className="py-3 text-sm">{tx.concept}</td>
                          <td className={`py-3 text-sm font-semibold ${tx.amount < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {formatCurrencyEUR(tx.amount)}
                          </td>
                          <td className="py-3 text-sm">
                            <div className="flex items-center gap-1">
                              <Select
                                value={tx.category_id || ''}
                                onValueChange={(val) => updateTransactionCategory(tx.id, val)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Sin categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  {sortedCategories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {tx.category_id && (
                                <button
                                  type="button"
                                  onClick={() => clearTransactionCategory(tx.id)}
                                  aria-label="Quitar categoría"
                                  title="Quitar categoría"
                                  data-testid={`clear-category-${tx.id}`}
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
