import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { TrendingDown, Search, Download, ChevronDown, ChevronRight, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatCurrencyEUR, buildMonthRangeParams } from '../utils/format';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatExpense = (value) => formatCurrencyEUR(Math.abs(value));

function ExpenseRow({ tx, subcategories, categories, onUpdate, onClear }) {
  const txSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === tx.category_id),
    [subcategories, tx.category_id]
  );
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );
  const sortedSubs = useMemo(
    () => [...txSubcategories].sort((a, b) => a.name.localeCompare(b.name)),
    [txSubcategories]
  );

  return (
    <tr data-testid={`expense-row-${tx.id}`} className="border-b border-gray-100">
      <td className="py-3 text-sm">{new Date(tx.date).toLocaleDateString('es-ES')}</td>
      <td className="py-3 text-sm max-w-[200px] truncate">{tx.concept}</td>
      <td className="py-3 text-sm font-semibold text-red-700">{formatExpense(tx.amount)}</td>
      <td className="py-3 text-sm">
        <div className="flex items-center gap-1">
          <Select value={tx.category_id || ''} onValueChange={(val) => onUpdate(tx.id, val, null)}>
            <SelectTrigger className="h-8 text-xs w-32">
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
              onClick={() => onClear(tx.id)}
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
      <td className="py-3 text-sm">
        {txSubcategories.length > 0 && (
          <Select
            value={tx.subcategory_id || 'none'}
            onValueChange={(val) => onUpdate(tx.id, tx.category_id, val === 'none' ? null : val)}
          >
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="Ninguna" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguna</SelectItem>
              {sortedSubs.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
    </tr>
  );
}

function CategoryGroup({ categoryData, expanded, onToggle }) {
  const hasSubcategories = Object.keys(categoryData.subcategories).length > 0;
  const sortedSubs = useMemo(
    () =>
      Object.entries(categoryData.subcategories).sort(([a], [b]) => a.localeCompare(b)),
    [categoryData.subcategories]
  );

  return (
    <div data-testid={`category-group-${categoryData.id}`} className="border border-gray-200 rounded-lg">
      <div
        data-testid={`category-group-header-${categoryData.id}`}
        className={`flex items-center justify-between p-3 rounded-lg ${hasSubcategories ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50'}`}
        onClick={() => hasSubcategories && onToggle(categoryData.id)}
      >
        <div className="flex items-center gap-2">
          {hasSubcategories && (
            expanded ?
              <ChevronDown className="w-4 h-4 text-gray-500" /> :
              <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="font-medium text-gray-700">{categoryData.name}</span>
        </div>
        <span className="font-semibold text-red-700">{formatExpense(categoryData.total)}</span>
      </div>
      {hasSubcategories && expanded && (
        <div className="pl-8 pr-3 pb-3 space-y-2">
          {sortedSubs.map(([subName, subAmount]) => (
            <div key={subName} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-600">• {subName}</span>
              <span className="font-medium text-red-600">{formatExpense(subAmount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Expenses() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [loading, setLoading] = useState(true);

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

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = { type: 'expense', ...buildMonthRangeParams(selectedYear, selectedMonth) };
      const response = await axios.get(`${API}/transactions`, { params });
      setTransactions(response.data);
    } catch (error) {
      toast.error('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadCategories();
    loadSubcategories();
  }, [loadCategories, loadSubcategories]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const getCategoryName = useCallback((id) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : 'Sin categoría';
  }, [categories]);

  const getSubcategoryName = useCallback((id) => {
    const sub = subcategories.find((s) => s.id === id);
    return sub ? sub.name : '';
  }, [subcategories]);

  const updateTransactionCategory = async (txId, categoryId, subcategoryId) => {
    try {
      const tx = transactions.find((t) => t.id === txId);

      if (tx && categoryId) {
        const sameConcept = transactions.filter((t) => t.concept === tx.concept);
        const updatePromises = sameConcept.map((t) =>
          axios.put(`${API}/transactions/${t.id}`, null, {
            params: { category_id: categoryId, subcategory_id: subcategoryId },
          })
        );
        await Promise.all(updatePromises);

        try {
          await axios.post(`${API}/rules`, {
            source: 'bank',
            contains: tx.concept,
            sign: '-',
            category_id: categoryId,
            subcategory_id: subcategoryId,
            priority: 5,
            active: true,
          });
          toast.success(`Categoría aplicada a ${sameConcept.length} movimiento(s) y regla creada`);
        } catch (ruleError) {
          toast.success(`Categoría aplicada a ${sameConcept.length} movimiento(s)`);
        }
      } else {
        await axios.put(`${API}/transactions/${txId}`, null, {
          params: { category_id: categoryId, subcategory_id: subcategoryId },
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
      await axios.put(`${API}/transactions/${txId}`, null, {
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
      const matchesSearch = tx.concept.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesCategory = true;
      if (selectedCategory === 'uncategorized') {
        matchesCategory = !tx.category_id || tx.category_id === '';
      } else if (selectedCategory) {
        matchesCategory = tx.category_id === selectedCategory;
      }
      const matchesSubcategory = !selectedSubcategory || tx.subcategory_id === selectedSubcategory;
      return matchesSearch && matchesCategory && matchesSubcategory;
    });
  }, [transactions, searchTerm, selectedCategory, selectedSubcategory]);

  const totalExpense = useMemo(
    () => filteredTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    [filteredTransactions]
  );

  const groupedByCategory = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const catId = tx.category_id || 'uncategorized';
      const catName = getCategoryName(tx.category_id);
      if (!acc[catId]) {
        acc[catId] = { id: catId, name: catName, total: 0, subcategories: {} };
      }
      acc[catId].total += Math.abs(tx.amount);
      if (tx.subcategory_id) {
        const subName = getSubcategoryName(tx.subcategory_id);
        if (!acc[catId].subcategories[subName]) acc[catId].subcategories[subName] = 0;
        acc[catId].subcategories[subName] += Math.abs(tx.amount);
      }
      return acc;
    }, {});
  }, [filteredTransactions, getCategoryName, getSubcategoryName]);

  const sortedGroupedCategories = useMemo(
    () => Object.values(groupedByCategory).sort((a, b) => a.name.localeCompare(b.name)),
    [groupedByCategory]
  );

  const sortedCategoriesFilter = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const sortedSubcategoriesFilter = useMemo(
    () =>
      subcategories
        .filter((sub) => !selectedCategory || sub.category_id === selectedCategory)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [subcategories, selectedCategory]
  );

  const toggleCategory = useCallback((catId) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  const exportToExcel = () => {
    const data = filteredTransactions.map((tx) => ({
      Fecha: tx.date,
      Concepto: tx.concept,
      Importe: Math.abs(tx.amount),
      Categoría: getCategoryName(tx.category_id),
      Subcategoría: getSubcategoryName(tx.subcategory_id),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `gastos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

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

      <Card className="border border-gray-200 bg-gradient-to-br from-red-50 to-rose-50">
        <CardContent className="pt-6">
          <div className="text-sm text-gray-600 mb-1">Total Gastos</div>
          <div className="text-3xl font-bold text-red-700" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {formatExpense(totalExpense)}
          </div>
          <div className="text-sm text-gray-600 mt-2">{filteredTransactions.length} transacciones</div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Año</label>
              <Select value={selectedYear || 'all'} onValueChange={(val) => setSelectedYear(val === 'all' ? '' : val)}>
                <SelectTrigger data-testid="year-filter-select-expenses">
                  <SelectValue placeholder="Todos los años" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los años</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Mes</label>
              <Select value={selectedMonth || 'all'} onValueChange={(val) => setSelectedMonth(val === 'all' ? '' : val)} disabled={!selectedYear}>
                <SelectTrigger data-testid="month-filter-select-expenses">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
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
                data-testid="clear-filters-btn-expenses"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Select value={selectedCategory || 'all'} onValueChange={(val) => { setSelectedCategory(val === 'all' ? '' : val); setSelectedSubcategory(''); }}>
              <SelectTrigger data-testid="category-filter-select-expenses">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="uncategorized">Sin categoría</SelectItem>
                {sortedCategoriesFilter.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSubcategory || 'all'} onValueChange={(val) => setSelectedSubcategory(val === 'all' ? '' : val)}>
              <SelectTrigger data-testid="subcategory-filter-select-expenses">
                <SelectValue placeholder="Filtrar por subcategoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las subcategorías</SelectItem>
                {sortedSubcategoriesFilter.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle>Resumen por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedGroupedCategories.map((categoryData) => (
              <CategoryGroup
                key={categoryData.id}
                categoryData={categoryData}
                expanded={!!expandedCategories[categoryData.id]}
                onToggle={toggleCategory}
              />
            ))}
          </div>
        </CardContent>
      </Card>

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
                  {filteredTransactions.map((tx) => (
                    <ExpenseRow
                      key={tx.id}
                      tx={tx}
                      subcategories={subcategories}
                      categories={categories}
                      onUpdate={updateTransactionCategory}
                      onClear={clearTransactionCategory}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
