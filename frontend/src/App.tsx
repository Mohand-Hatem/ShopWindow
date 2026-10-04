import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AdminBenchmarkPage } from './pages/admin/AdminBenchmarkPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminCachePage } from './pages/admin/AdminCachePage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { ExplanationPhasesPage } from './pages/ExplanationPhasesPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-black text-[#f0f0f0]">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
          <Routes>
            {/* Public Storefront Routes */}
            <Route path="/" element={<CatalogPage />} />
            <Route path="/products" element={<CatalogPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />

            {/* Educational Reference Guides */}
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/explanation-phases" element={<ExplanationPhasesPage />} />

            {/* Direct Benchmark Route */}
            <Route path="/benchmark" element={<AdminBenchmarkPage />} />

            {/* Admin Control Center Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/cache" replace />} />
              <Route path="cache" element={<AdminCachePage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="benchmark" element={<AdminBenchmarkPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/products" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
