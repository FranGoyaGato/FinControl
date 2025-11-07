import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ImportData() {
  const [step, setStep] = useState(1); // 1: select, 2: upload, 3: preview, 4: confirm
  const [importType, setImportType] = useState('account'); // 'account' or 'card'
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadCards();
    loadCategories();
  }, []);

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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedEntity) {
      toast.error('Selecciona una cuenta/tarjeta y un archivo');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/import/parse-csv?import_type=${importType}&entity_id=${selectedEntity}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setPreview(response.data.preview);
      setStep(3);
      toast.success(`${response.data.count} transacciones detectadas`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al procesar el archivo CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/import/confirm`, {
        import_type: importType,
        entity_id: selectedEntity,
        transactions: preview
      });

      toast.success(`Importadas: ${response.data.inserted}, Duplicadas: ${response.data.duplicates}`);
      resetForm();
    } catch (error) {
      console.error('Error confirming import:', error);
      toast.error('Error al confirmar la importación');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFile(null);
    setPreview([]);
    setSelectedEntity('');
  };

  const updatePreviewCategory = (index, categoryId) => {
    const updated = [...preview];
    updated[index].category_id = categoryId;
    setPreview(updated);
  };

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Sin categoría';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(Math.abs(value));
  };

  const entities = importType === 'account' ? accounts : cards;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          <Upload className="w-8 h-8 text-indigo-600" />
          Importar Movimientos
        </h1>
        <p className="text-gray-600 mt-1">Importa movimientos desde archivos CSV</p>
      </div>

      {/* Progress Steps */}
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {['Seleccionar', 'Subir CSV', 'Previsualizar', 'Confirmar'].map((label, idx) => (
              <div key={idx} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step > idx + 1 ? 'bg-green-500 text-white' :
                  step === idx + 1 ? 'bg-indigo-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {step > idx + 1 ? '✓' : idx + 1}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700 hidden md:inline">{label}</span>
                {idx < 3 && <div className="w-12 h-0.5 bg-gray-300 mx-2 hidden md:block" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Select Type and Entity */}
      {step === 1 && (
        <Card data-testid="import-step-1" className="border border-gray-200">
          <CardHeader>
            <CardTitle>Paso 1: Selecciona el tipo de importación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo de movimiento</label>
              <Select value={importType} onValueChange={(val) => { setImportType(val); setSelectedEntity(''); }}>
                <SelectTrigger data-testid="import-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Cuenta Bancaria</SelectItem>
                  <SelectItem value="card">Tarjeta de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                {importType === 'account' ? 'Cuenta' : 'Tarjeta'}
              </label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger data-testid="entity-select">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Formato CSV/Excel:</p>
                  {importType === 'account' ? (
                    <p>Columnas: <code>fecha, concepto, importe, saldo</code></p>
                  ) : (
                    <p>Columnas: <code>fecha, concepto, importe</code></p>
                  )}
                  <p className="mt-1">Formato fecha: DD/MM/YYYY</p>
                  <p className="text-xs mt-1">Formatos aceptados: .csv, .xls y .xlsx</p>
                </div>
              </div>
            </div>

            <Button
              data-testid="next-to-upload-btn"
              onClick={() => setStep(2)}
              disabled={!selectedEntity}
              className="w-full"
            >
              Siguiente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload File */}
      {step === 2 && (
        <Card data-testid="import-step-2" className="border border-gray-200">
          <CardHeader>
            <CardTitle>Paso 2: Sube el archivo CSV o Excel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <input
                data-testid="file-input"
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file"
              />
              <label htmlFor="csv-file" className="cursor-pointer">
                <Button data-testid="choose-file-btn" variant="outline" asChild>
                  <span>Seleccionar archivo CSV o Excel</span>
                </Button>
              </label>
              {file && (
                <p className="text-sm text-gray-600 mt-2">Archivo: {file.name}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button data-testid="back-to-step-1-btn" onClick={() => setStep(1)} variant="outline" className="flex-1">
                Atrás
              </Button>
              <Button
                data-testid="upload-csv-btn"
                onClick={handleUpload}
                disabled={!file || loading}
                className="flex-1"
              >
                {loading ? 'Procesando...' : 'Procesar CSV'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <Card data-testid="import-step-3" className="border border-gray-200">
          <CardHeader>
            <CardTitle>Paso 3: Previsualización ({preview.length} transacciones)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 text-left">Fecha</th>
                    <th className="pb-2 text-left">Concepto</th>
                    <th className="pb-2 text-left">Importe</th>
                    <th className="pb-2 text-left">Categoría</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((tx, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2">{tx.date}</td>
                      <td className="py-2">{tx.concept}</td>
                      <td className="py-2 font-semibold">{formatCurrency(tx.amount)}</td>
                      <td className="py-2">
                        <Select
                          value={tx.category_id || ''}
                          onValueChange={(val) => updatePreviewCategory(idx, val)}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button data-testid="back-to-step-2-btn" onClick={() => setStep(2)} variant="outline" className="flex-1">
                Atrás
              </Button>
              <Button data-testid="next-to-confirm-btn" onClick={() => setStep(4)} className="flex-1">
                Siguiente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <Card data-testid="import-step-4" className="border border-gray-200">
          <CardHeader>
            <CardTitle>Paso 4: Confirmar importación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-3 text-green-600" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">¿Confirmar importación?</h3>
              <p className="text-green-700">
                Se importarán <strong>{preview.length}</strong> transacciones a {importType === 'account' ? 'la cuenta' : 'la tarjeta'} seleccionada.
              </p>
            </div>

            <div className="flex gap-2">
              <Button data-testid="back-to-preview-btn" onClick={() => setStep(3)} variant="outline" className="flex-1">
                Atrás
              </Button>
              <Button
                data-testid="confirm-import-btn"
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Importando...' : 'Confirmar Importación'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
