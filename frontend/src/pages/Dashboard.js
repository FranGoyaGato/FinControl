import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, DollarSign, Calendar, PieChart as PieIcon, LineChart as LineIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatCurrencyEUR } from '../utils/format';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DONUT_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#a855f7',
  '#22c55e', '#0ea5e9', '#eab308', '#d946ef', '#84cc16',
  '#f43f5e', '#06b6d4', '#facc15', '#7c3aed', '#e11d48',
];

function KPICard({ title, value, subtitle, icon: Icon, colorClass, valueColorClass }) {
  return (
    <Card data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`} className="border border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColorClass || ''}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{value}</div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-sm">
      <div className="font-medium text-gray-800">{p.name}</div>
      <div className="text-red-700 font-semibold">{formatCurrencyEUR(p.value)}</div>
    </div>
  );
}

function LineTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-sm">
      <div className="font-medium text-gray-800 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color }}>{formatCurrencyEUR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [viewType, setViewType] = useState('month'); // 'month' or 'year'
  const [kpis, setKpis] = useState({ total_income: 0, total_expense: 0, net_flow: 0, transaction_count: 0 });
  const [donutData, setDonutData] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/accounts`);
      setAccounts(response.data);
    } catch (error) {
      toast.error('Error al cargar cuentas');
    }
  }, []);

  const { periodParams, chartYear } = useMemo(() => {
    const p = {};
    if (selectedAccount !== 'all') p.account_id = selectedAccount;
    let year;
    if (viewType === 'year') {
      year = new Date().getFullYear();
      const today = new Date().toISOString().split('T')[0];
      p.date_from = `${year}-01-01`;
      p.date_to = today;
    } else if (viewType === 'previous_year') {
      year = new Date().getFullYear() - 1;
      p.date_from = `${year}-01-01`;
      p.date_to = `${year}-12-31`;
    } else if (selectedMonth) {
      const [y, m] = selectedMonth.split('-');
      year = parseInt(y, 10);
      p.date_from = `${y}-${m}-01`;
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      p.date_to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    } else {
      year = new Date().getFullYear();
    }
    return { periodParams: p, chartYear: year };
  }, [selectedAccount, selectedMonth, viewType]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [kpiRes, donutRes, monthlyRes] = await Promise.all([
        axios.get(`${API}/dashboard`, { params: periodParams }),
        axios.get(`${API}/dashboard/expense-by-category`, { params: periodParams }),
        axios.get(`${API}/dashboard/monthly-summary`, {
          params: {
            year: chartYear,
            ...(selectedAccount !== 'all' ? { account_id: selectedAccount } : {}),
          },
        }),
      ]);
      setKpis(kpiRes.data);
      setDonutData(donutRes.data);
      setMonthly(monthlyRes.data);
    } catch (error) {
      toast.error('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, [periodParams, chartYear, selectedAccount]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  const isYearView = viewType === 'year' || viewType === 'previous_year';

  const getPeriodLabel = () => {
    if (viewType === 'year') {
      const currentYear = new Date().getFullYear();
      return `Año ${currentYear} (hasta hoy)`;
    }
    if (viewType === 'previous_year') {
      return `Año ${new Date().getFullYear() - 1}`;
    }
    const date = new Date(selectedMonth + '-01');
    const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const donutTotal = useMemo(
    () => donutData.reduce((sum, d) => sum + d.total, 0),
    [donutData]
  );

  const donutForChart = useMemo(
    () => donutData.map((d) => ({ name: d.name, value: d.total })),
    [donutData]
  );

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
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={viewType === 'month' ? 'default' : 'outline'}
                    onClick={() => setViewType('month')}
                    className="flex-1"
                    data-testid="view-month-btn"
                  >
                    Mes
                  </Button>
                  <Button
                    type="button"
                    variant={viewType === 'year' ? 'default' : 'outline'}
                    onClick={() => setViewType('year')}
                    className="flex-1"
                    data-testid="view-year-btn"
                  >
                    Año actual
                  </Button>
                  <Button
                    type="button"
                    variant={viewType === 'previous_year' ? 'default' : 'outline'}
                    onClick={() => setViewType('previous_year')}
                    className="flex-1"
                    data-testid="view-previous-year-btn"
                  >
                    Año anterior
                  </Button>
                </div>
                {viewType === 'month' && (
                  <input
                    data-testid="month-input"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard
              title={isYearView ? "Ingresos del Año" : "Ingresos del Mes"}
              value={formatCurrencyEUR(kpis.total_income)}
              icon={TrendingUp}
              colorClass="text-blue-600"
              valueColorClass="text-blue-700"
            />
            <KPICard
              title={isYearView ? "Gastos del Año" : "Gastos del Mes"}
              value={formatCurrencyEUR(kpis.total_expense)}
              icon={TrendingDown}
              colorClass="text-red-600"
              valueColorClass="text-red-700"
            />
            <KPICard
              title="Flujo Neto"
              value={formatCurrencyEUR(kpis.net_flow)}
              subtitle={kpis.net_flow >= 0 ? 'Balance positivo' : 'Balance negativo'}
              icon={DollarSign}
              colorClass={kpis.net_flow >= 0 ? 'text-blue-600' : 'text-red-600'}
              valueColorClass={kpis.net_flow >= 0 ? 'text-blue-700' : 'text-red-700'}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut: expenses by category */}
            <Card data-testid="donut-card" className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieIcon className="w-4 h-4 text-indigo-600" />
                  Gastos por categoría — {getPeriodLabel()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {donutForChart.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-16">Sin gastos en este periodo</div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="w-full md:w-1/2 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={donutForChart}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={2}
                            stroke="#ffffff"
                            strokeWidth={2}
                          >
                            {donutForChart.map((entry, index) => (
                              <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<DonutTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 space-y-1 max-h-64 overflow-y-auto pr-2">
                      {donutData.map((d, idx) => {
                        const pct = donutTotal ? (d.total / donutTotal) * 100 : 0;
                        return (
                          <div key={d.category_id || 'uncat'} data-testid={`donut-legend-${d.category_id || 'uncategorized'}`} className="flex items-center justify-between text-xs py-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                              <span className="truncate text-gray-700">{d.name}</span>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <div className="font-semibold text-gray-800">{formatCurrencyEUR(d.total)}</div>
                              <div className="text-gray-400">{pct.toFixed(1)}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line: monthly net flow */}
            <Card data-testid="monthly-line-card" className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LineIcon className="w-4 h-4 text-indigo-600" />
                  Flujo mensual — {chartYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip content={<LineTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="income" name="Ingresos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="expense" name="Gastos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="net_flow" name="Flujo neto" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
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
