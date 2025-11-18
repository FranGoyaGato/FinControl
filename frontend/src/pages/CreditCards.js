import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditCard, Search } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CreditCards() {
  const [transactions, setTransactions] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCard) {
      loadTransactions();
    }
  }, [selectedCard]);

  const loadCards = async () => {
    try {
      const response = await axios.get(`${API}/credit-cards`);
      setCards(response.data);
      if (response.data.length > 0 && !selectedCard) {
        setSelectedCard(response.data[0].id);
      }
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

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/card-transactions`, {
        params: { card_id: selectedCard }
      });
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  };

  const updateTransactionCategory = async (txId, categoryId) => {
    try {
      const tx = transactions.find(t => t.id === txId);
      
      if (tx && categoryId) {
        // Apply to ALL transactions with same concept
        const sameConcept = transactions.filter(t => t.concept === tx.concept);
        
        // Update all matching transactions
        const updatePromises = sameConcept.map(t => 
          axios.put(`${API}/card-transactions/${t.id}`, null, {
            params: { category_id: categoryId }
          })
        );
        
        await Promise.all(updatePromises);
        
        // Create automatic rule for future transactions
        try {
          await axios.post(`${API}/rules`, {
            source: 'card',
            contains: tx.concept,
            sign: null,
            category_id: categoryId,
            subcategory_id: null,
            priority: 5,
            active: true
          });
          toast.success(`Categoría aplicada a ${sameConcept.length} movimiento(s) y regla creada`);
        } catch (ruleError) {
          toast.success(`Categoría aplicada a ${sameConcept.length} movimiento(s)`);
        }
      } else {
        await axios.put(`${API}/card-transactions/${txId}`, null, {
          params: { category_id: categoryId }
        });
        toast.success('Categoría actualizada');
      }
      
      loadTransactions();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Error al actualizar categoría');
    }
  };

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Sin categoría';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const filteredTransactions = transactions.filter(tx =>
    tx.concept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

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
          {/* Card Selector */}
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

          {/* Summary */}
          <Card className="border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Total Movimientos</div>
              <div className={`text-3xl font-bold ${totalAmount < 0 ? 'text-red-700' : 'text-blue-700'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {formatCurrency(totalAmount)}
              </div>
              <div className="text-sm text-gray-600 mt-2">{filteredTransactions.length} transacciones</div>
            </CardContent>
          </Card>

          {/* Search */}
          <Card data-testid="card-search" className="border border-gray-200">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  data-testid="search-card-transactions-input"
                  type="text"
                  placeholder="Buscar por concepto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
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
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 text-sm">
                            <Select
                              value={tx.category_id || ''}
                              onValueChange={(val) => updateTransactionCategory(tx.id, val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Sin categoría" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
