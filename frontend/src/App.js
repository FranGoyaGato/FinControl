import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import MainLayout from '@/components/MainLayout';
import Dashboard from '@/pages/Dashboard';
import Income from '@/pages/Income';
import Expenses from '@/pages/Expenses';
import CreditCards from '@/pages/CreditCards';
import ImportData from '@/pages/ImportData';
import Settings from '@/pages/Settings';
import '@/App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/income" element={<Income />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/cards" element={<CreditCards />} />
            <Route path="/import" element={<ImportData />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
      <Toaster position="top-center" expand={true} richColors />
    </div>
  );
}

export default App;
