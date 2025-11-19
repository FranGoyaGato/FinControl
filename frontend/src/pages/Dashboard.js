import { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function KPICard({ title, value, subtitle, icon: Icon, colorClass }) {
  return (
    <Card data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`} className="border border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{value}</div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [viewType, setViewType] = useState('month'); // 'month' or 'year'
  const [kpis, setKpis] = useState({
    total_income: 0,
    total_expense: 0,
    net_flow: 0,
    transaction_count: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [selectedAccount, selectedMonth, viewType]);

  const loadAccounts = async () => {
    try {
      const response = await axios.get(`${API}/accounts`);
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (selectedAccount !== 'all') {
        params.account_id = selectedAccount;
      }
      
      if (selectedPeriod) {
        if (selectedPeriod === 'year-current') {
          // Año actual: desde 1 de enero hasta hoy
          const currentYear = new Date().getFullYear();
          const today = new Date().toISOString().split('T')[0];
          params.date_from = `${currentYear}-01-01`;
          params.date_to = today;
        } else {
          // Mes específico
          const [year, month] = selectedPeriod.split('-');
          params.date_from = `${year}-${month}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          params.date_to = `${year}-${month}-${lastDay}`;
        }
      }
      
      const response = await axios.get(`${API}/dashboard`, { params });
      setKpis(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  // Generar opciones de meses (últimos 12 meses + año actual)
  const generatePeriodOptions = () => {
    const options = [{ value: 'year-current', label: 'Año actual' }];
    const today = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    
    return options;
  };

  const isYearView = selectedPeriod === 'year-current';

  const getPeriodLabel = () => {
    if (isYearView) {
      const currentYear = new Date().getFullYear();
      return `Año ${currentYear} (hasta hoy)`;
    }
    const date = new Date(selectedPeriod + '-01');
    const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Dashboard</h1>
        <p className="text-gray-600 mt-1">Resumen general de tus finanzas</p>
      </div>

      {/* Filters */}
      <Card data-testid="filters-card" className="border border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Cuenta</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger data-testid="account-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Periodo</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger data-testid="period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generatePeriodOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard
            title={isYearView ? "Ingresos del Año" : "Ingresos del Mes"}
            value={formatCurrency(kpis.total_income)}
            icon={TrendingUp}
            colorClass="text-green-600"
          />
          <KPICard
            title={isYearView ? "Gastos del Año" : "Gastos del Mes"}
            value={formatCurrency(kpis.total_expense)}
            icon={TrendingDown}
            colorClass="text-red-600"
          />
          <KPICard
            title="Flujo Neto"
            value={formatCurrency(kpis.net_flow)}
            subtitle={kpis.net_flow >= 0 ? 'Balance positivo' : 'Balance negativo'}
            icon={DollarSign}
            colorClass={kpis.net_flow >= 0 ? 'text-green-600' : 'text-red-600'}
          />
        </div>
      )}

      {/* Info Card */}
      <Card className="border border-gray-200 bg-indigo-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-indigo-600 mt-1" />
            <div>
              <h3 className="font-semibold text-indigo-900">Periodo seleccionado</h3>
              <p className="text-sm text-indigo-700 mt-1">
                Mostrando datos de {getPeriodLabel()}
                {selectedAccount !== 'all' && ` para la cuenta seleccionada`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
