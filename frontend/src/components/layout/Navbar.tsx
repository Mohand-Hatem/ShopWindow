import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useHealthQuery } from '../../hooks/useProducts';
import { Activity, ShieldCheck, Menu, X, BookOpen, Compass } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { data: health } = useHealthQuery();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/products' && (location.pathname === '/' || location.pathname === '/products')) {
      return true;
    }
    return location.pathname.startsWith(path);
  };

  const isHealthy = health?.data?.status === 'ok';

  return (
    <header className="sticky top-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-frost">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" viewTransition className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-mono font-bold text-sm shadow-ring group-hover:bg-[#ff801f] group-hover:text-black transition-colors duration-200">
            SW
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl text-[#f0f0f0] tracking-tight group-hover:text-white flex items-center gap-1.5">
              ShopWindow
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff801f]"></span>
            </span>
            <span className="text-[10px] font-mono text-[#a1a4a5] uppercase tracking-wider -mt-1">
              Caching Laboratory
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/products"
            viewTransition
            className={`text-sm font-medium transition-colors ${
              isActive('/products')
                ? 'text-white border-b-2 border-[#ff801f] pb-1'
                : 'text-[#a1a4a5] hover:text-white'
            }`}
          >
            Catalog
          </Link>
          <Link
            to="/how-it-works"
            viewTransition
            className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isActive('/how-it-works')
                ? 'text-white border-b-2 border-[#ff801f] pb-1'
                : 'text-[#a1a4a5] hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#11ff99]" />
            How It Works
          </Link>
          <Link
            to="/explanation-phases"
            viewTransition
            className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isActive('/explanation-phases')
                ? 'text-white border-b-2 border-[#ff801f] pb-1'
                : 'text-[#a1a4a5] hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4 text-[#ff801f]" />
            Phases Guide
          </Link>
          <Link
            to="/benchmark"
            viewTransition
            className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isActive('/benchmark')
                ? 'text-white border-b-2 border-[#ff801f] pb-1'
                : 'text-[#a1a4a5] hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 text-[#ff801f]" />
            Benchmark Lab
          </Link>
          <Link
            to="/admin"
            viewTransition
            className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isActive('/admin')
                ? 'text-white border-b-2 border-[#ff801f] pb-1'
                : 'text-[#a1a4a5] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#3b9eff]" />
            Admin Portal
          </Link>
        </nav>

        {/* System Diagnostics Healthchip */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#000000] border border-frost text-xs font-mono">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isHealthy ? 'bg-[#11ff99]' : 'bg-[#ffc53d]'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isHealthy ? 'bg-[#11ff99]' : 'bg-[#ffc53d]'
                }`}
              ></span>
            </span>
            <span className="text-[#a1a4a5]">
              Redis & DB:{' '}
              <strong className={isHealthy ? 'text-[#11ff99]' : 'text-[#ffc53d]'}>
                {isHealthy ? 'HEALTHY' : 'DEGRADED'}
              </strong>
            </span>
            {health?.data?.queries?.productDetail !== undefined && (
              <span className="text-[#a1a4a5] border-l border-frost pl-2">
                SQL: {health.data.queries.productDetail}
              </span>
            )}
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#a1a4a5] hover:text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#000000] border-b border-frost px-4 pt-3 pb-6 space-y-4">
          <Link
            to="/products"
            viewTransition
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#f0f0f0] hover:text-[#ff801f]"
          >
            Catalog
          </Link>
          <Link
            to="/how-it-works"
            viewTransition
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#f0f0f0] hover:text-[#ff801f]"
          >
            How It Works
          </Link>
          <Link
            to="/explanation-phases"
            viewTransition
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#f0f0f0] hover:text-[#ff801f]"
          >
            Phases Guide (1-20)
          </Link>
          <Link
            to="/benchmark"
            viewTransition
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#f0f0f0] hover:text-[#ff801f]"
          >
            Benchmark Lab
          </Link>
          <Link
            to="/admin"
            viewTransition
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#f0f0f0] hover:text-[#ff801f]"
          >
            Admin Portal
          </Link>
        </div>
      )}
    </header>
  );
};
