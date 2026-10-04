import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Package, Zap } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-frost pb-2 overflow-x-auto">
        <NavLink
          to="/admin/cache"
          viewTransition
          className={({ isActive }) =>
            `px-4 py-2 rounded-full text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
              isActive
                ? 'bg-white text-black font-bold shadow-ring'
                : 'text-[#a1a4a5] hover:text-white hover:bg-zinc-900/60'
            }`
          }
        >
          <Zap className="w-3.5 h-3.5 text-[#11ff99]" />
          <span>Cache Telemetry & Purge</span>
        </NavLink>

        <NavLink
          to="/admin/products"
          viewTransition
          className={({ isActive }) =>
            `px-4 py-2 rounded-full text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
              isActive
                ? 'bg-white text-black font-bold shadow-ring'
                : 'text-[#a1a4a5] hover:text-white hover:bg-zinc-900/60'
            }`
          }
        >
          <Package className="w-3.5 h-3.5 text-[#ff801f]" />
          <span>Product Inventory & Invalidation</span>
        </NavLink>

        <NavLink
          to="/admin/benchmark"
          viewTransition
          className={({ isActive }) =>
            `px-4 py-2 rounded-full text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
              isActive
                ? 'bg-white text-black font-bold shadow-ring'
                : 'text-[#a1a4a5] hover:text-white hover:bg-zinc-900/60'
            }`
          }
        >
          <Activity className="w-3.5 h-3.5 text-[#3b9eff]" />
          <span>Benchmark Comparison Lab</span>
        </NavLink>
      </div>

      <Outlet />
    </div>
  );
};
