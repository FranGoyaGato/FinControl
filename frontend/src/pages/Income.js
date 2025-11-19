import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { TrendingUp, Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Income() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
    loadSubcategories();
    loadTransactions();
  }, [selectedYear, selectedMonth]);

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
      const params = { type: 'income' };
      
      // Add date filters if selected
      if (selectedYear && selectedMonth) {
        const month = selectedMonth.padStart(2, '0');
        params.date_from = `${selectedYear}-${month}-01`;
        const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
        params.date_to = `${selectedYear}-${month}-${String(lastDay).padStart(2, '0')}`;
      } else if (selectedYear) {
        params.date_from = `${selectedYear}-01-01`;
        params.date_to = `${selectedYear}-12-31`;
      }
      
      const response = await axios.get(`${API}/transactions`, { params });
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Error al cargar ingresos');
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
            sign: '+',
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
      Importe: tx.amount,
      Categoría: getCategoryName(tx.category_id),
      Subcategoría: getSubcategoryName(tx.subcategory_id)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos');
    XLSX.writeFile(wb, `ingresos_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).format(value);
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.concept.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || tx.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalIncome = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  // Group by category
  const groupedByCategory = filteredTransactions.reduce((acc, tx) => {
    const catName = getCategoryName(tx.category_id);
    if (!acc[catName]) acc[catName] = 0;
    acc[catName] += tx.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            <TrendingUp className="w-8 h-8 text-green-600" />
            Ingresos
          </h1>
          <p className="text-gray-600 mt-1">Gestiona tus ingresos</p>
        </div>
        <Button data-testid="export-income-btn" onClick={exportToExcel} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="border border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardContent className="pt-6">
          <div className="text-sm text-gray-600 mb-1">Total Ingresos</div>
          <div className="text-3xl font-bold text-green-700" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {formatCurrency(totalIncome)}
          </div>
          <div className="text-sm text-gray-600 mt-2">{filteredTransactions.length} transacciones</div>
        </CardContent>
      </Card>

      {/* Date Filters */}
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Año</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger data-testid="year-filter-select">
                  <SelectValue placeholder="Todos los años" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los años</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Mes</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!selectedYear}>
                <SelectTrigger data-testid="month-filter-select">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los meses</SelectItem>
                  <SelectItem value="1">Enero</SelectItem>
                  <SelectItem value="2">Febrero</SelectItem>
                  <SelectItem value="3">Marzo</SelectItem>
                  <SelectItem value="4">Abril</SelectItem>
                  <SelectItem value="5">Mayo</SelectItem>
                  <SelectItem value="6">Junio</SelectItem>
                  <SelectItem value="7">Julio</SelectItem>
                  <SelectItem value="8">Agosto</SelectItem>
                  <SelectItem value="9">Septiembre</SelectItem>
                  <SelectItem value="10">Octubre</SelectItem>
                  <SelectItem value="11">Noviembre</SelectItem>
                  <SelectItem value="12">Diciembre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => { setSelectedYear(''); setSelectedMonth(''); }}
                className="w-full"
                data-testid="clear-filters-btn"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Category Filters */}
      <Card data-testid="income-filters" className="border border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                data-testid="search-income-input"
                type="text"
                placeholder="Buscar por concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
              <SelectTrigger data-testid="category-filter-select">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
          <div className="space-y-3">
            {Object.entries(groupedByCategory).map(([category, amount]) => (
              <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">{category}</span>
                <span className="font-semibold text-green-700">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card data-testid="income-transactions-table" className="border border-gray-200">
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay ingresos registrados</p>
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
                      <tr key={tx.id} data-testid={`income-row-${tx.id}`} className="border-b border-gray-100">
                        <td className="py-3 text-sm">{new Date(tx.date).toLocaleDateString('es-ES')}</td>
                        <td className="py-3 text-sm max-w-[200px] truncate">{tx.concept}</td>
                        <td className="py-3 text-sm font-semibold text-green-700">{formatCurrency(tx.amount)}</td>
                        <td className="py-3 text-sm">
                          <Select
                            value={tx.category_id || ''}
                            onValueChange={(val) => updateTransactionCategory(tx.id, val, null)}
                          >
                            <SelectTrigger className="h-8 text-xs w-32">
                              <SelectValue placeholder="Sin categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
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
                                {txSubcategories.sort((a, b) => a.name.localeCompare(b.name)).map((sub) => (
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
