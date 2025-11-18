import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { TrendingDown, Search, Download, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Expenses() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
    loadSubcategories();
    loadTransactions();
  }, []);

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

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/transactions`, {
        params: { type: 'expense' }
      });
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  };

  const updateTransactionCategory = async (txId, categoryId, subcategoryId) => {
    try {
      const tx = transactions.find(t => t.id === txId);
      
      if (tx && categoryId) {
        // Apply to ALL transactions with same concept
        const sameConcept = transactions.filter(t => t.concept === tx.concept);
        
        // Update all matching transactions
        const updatePromises = sameConcept.map(t => 
          axios.put(`${API}/transactions/${t.id}`, null, {
            params: { category_id: categoryId, subcategory_id: subcategoryId }
          })
        );
        
        await Promise.all(updatePromises);
        
        // Create automatic rule for future transactions
        try {
          await axios.post(`${API}/rules`, {
            source: 'bank',
            contains: tx.concept,
            sign: '-',
            category_id: categoryId,
            subcategory_id: subcategoryId,
            priority: 5,
            active: true
          });
          toast.success(`Categoría aplicada a ${sameConcept.length} movimiento(s) y regla creada`);
        } catch (ruleError) {
          toast.success(`Categoría aplicada a ${sameConcept.length} movimiento(s)`);
        }
      } else {
        await axios.put(`${API}/transactions/${txId}`, null, {
          params: { category_id: categoryId, subcategory_id: subcategoryId }
        });
        toast.success('Categoría actualizada');
      }
      
      loadTransactions();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Error al actualizar categoría');
    }
  };

  const exportToExcel = () => {
    const data = filteredTransactions.map(tx => ({
      Fecha: tx.date,
      Concepto: tx.concept,
      Importe: Math.abs(tx.amount),
      Categoría: getCategoryName(tx.category_id),
      Subcategoría: getSubcategoryName(tx.subcategory_id)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `gastos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Sin categoría';
  };

  const getSubcategoryName = (id) => {
    const sub = subcategories.find(s => s.id === id);
    return sub ? sub.name : '';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(Math.abs(value));
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.concept.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || tx.category_id === selectedCategory;
    const matchesSubcategory = !selectedSubcategory || tx.subcategory_id === selectedSubcategory;
    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  const totalExpense = filteredTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  // Group by category with subcategories
  const groupedByCategory = filteredTransactions.reduce((acc, tx) => {
    const catId = tx.category_id || 'uncategorized';
    const catName = getCategoryName(tx.category_id);
    
    if (!acc[catId]) {
      acc[catId] = {
        id: catId,
        name: catName,
        total: 0,
        subcategories: {}
      };
    }
    
    acc[catId].total += Math.abs(tx.amount);
    
    // Group by subcategory within category
    if (tx.subcategory_id) {
      const subName = getSubcategoryName(tx.subcategory_id);
      if (!acc[catId].subcategories[subName]) {
        acc[catId].subcategories[subName] = 0;
      }
      acc[catId].subcategories[subName] += Math.abs(tx.amount);
    }
    
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            <TrendingDown className="w-8 h-8 text-red-600" />
            Gastos
          </h1>
          <p className="text-gray-600 mt-1">Gestiona tus gastos</p>
        </div>
        <Button data-testid="export-expenses-btn" onClick={exportToExcel} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="border border-gray-200 bg-gradient-to-br from-red-50 to-rose-50">
        <CardContent className="pt-6">
          <div className="text-sm text-gray-600 mb-1">Total Gastos</div>
          <div className="text-3xl font-bold text-red-700" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {formatCurrency(totalExpense)}
          </div>
          <div className="text-sm text-gray-600 mt-2">{filteredTransactions.length} transacciones</div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card data-testid="expenses-filters" className="border border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                data-testid="search-expenses-input"
                type="text"
                placeholder="Buscar por concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val); setSelectedSubcategory(''); }}>
              <SelectTrigger data-testid="category-filter-select-expenses">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las categorías</SelectItem>
                {categories.sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
              <SelectTrigger data-testid="subcategory-filter-select-expenses">
                <SelectValue placeholder="Filtrar por subcategoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las subcategorías</SelectItem>
                {subcategories
                  .filter(sub => !selectedCategory || sub.category_id === selectedCategory)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Summary */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle>Resumen por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.values(groupedByCategory)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((categoryData) => {
                const hasSubcategories = Object.keys(categoryData.subcategories).length > 0;
                const isExpanded = expandedCategories[categoryData.id];
                
                return (
                  <div key={categoryData.id} className="border border-gray-200 rounded-lg">
                    <div 
                      className={`flex items-center justify-between p-3 rounded-lg ${hasSubcategories ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50'}`}
                      onClick={() => hasSubcategories && setExpandedCategories({
                        ...expandedCategories,
                        [categoryData.id]: !isExpanded
                      })}
                    >
                      <div className="flex items-center gap-2">
                        {hasSubcategories && (
                          isExpanded ? 
                            <ChevronDown className="w-4 h-4 text-gray-500" /> : 
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-medium text-gray-700">{categoryData.name}</span>
                      </div>
                      <span className="font-semibold text-red-700">{formatCurrency(categoryData.total)}</span>
                    </div>
                    
                    {hasSubcategories && isExpanded && (
                      <div className="pl-8 pr-3 pb-3 space-y-2">
                        {Object.entries(categoryData.subcategories)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([subName, subAmount]) => (
                            <div key={subName} className="flex items-center justify-between py-2 text-sm">
                              <span className="text-gray-600">• {subName}</span>
                              <span className="font-medium text-red-600">{formatCurrency(subAmount)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card data-testid="expenses-transactions-table" className="border border-gray-200">
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TrendingDown className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay gastos registrados</p>
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
                    <th className="pb-3 text-sm font-semibold text-gray-600">Subcategoría</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const txSubcategories = subcategories.filter(s => s.category_id === tx.category_id);
                    return (
                      <tr key={tx.id} data-testid={`expense-row-${tx.id}`} className="border-b border-gray-100">
                        <td className="py-3 text-sm">{new Date(tx.date).toLocaleDateString('es-ES')}</td>
                        <td className="py-3 text-sm max-w-[200px] truncate">{tx.concept}</td>
                        <td className="py-3 text-sm font-semibold text-red-700">{formatCurrency(tx.amount)}</td>
                        <td className="py-3 text-sm">
                          <Select
                            value={tx.category_id || ''}
                            onValueChange={(val) => updateTransactionCategory(tx.id, val, null)}
                          >
                            <SelectTrigger className="h-8 text-xs w-32">
                              <SelectValue placeholder="Sin categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 text-sm">
                          {txSubcategories.length > 0 && (
                            <Select
                              value={tx.subcategory_id || 'none'}
                              onValueChange={(val) => updateTransactionCategory(tx.id, tx.category_id, val === 'none' ? null : val)}
                            >
                              <SelectTrigger className="h-8 text-xs w-32">
                                <SelectValue placeholder="Ninguna" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Ninguna</SelectItem>
                                {txSubcategories.map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
