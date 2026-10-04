import React from 'react';
import { Zap, Database, AlertTriangle, Layers } from 'lucide-react';

interface CacheBadgeProps {
  status: 'HIT' | 'MISS' | 'BYPASS' | 'CLIENT_CACHE' | 'UNKNOWN';
  durationMs?: number;
  className?: string;
  showIcon?: boolean;
}

export const CacheBadge: React.FC<CacheBadgeProps> = ({
  status,
  durationMs,
  className = '',
  showIcon = true,
}) => {
  let bg = 'bg-[#11ff99]/10 text-[#11ff99] border-[#11ff99]/30';
  let label = 'REDIS HIT';
  let Icon = Zap;

  if (status === 'CLIENT_CACHE') {
    bg = 'bg-[#3b9eff]/10 text-[#3b9eff] border-[#3b9eff]/30';
    label = 'CLIENT MEMORY';
    Icon = Layers;
  } else if (status === 'MISS') {
    bg = 'bg-[#ff2047]/10 text-[#ff2047] border-[#ff2047]/30';
    label = 'DB MISS';
    Icon = Database;
  } else if (status === 'BYPASS') {
    bg = 'bg-[#ffc53d]/10 text-[#ffc53d] border-[#ffc53d]/30';
    label = 'BYPASS';
    Icon = AlertTriangle;
  } else if (status === 'UNKNOWN') {
    bg = 'bg-[#a1a4a5]/10 text-[#a1a4a5] border-[#a1a4a5]/30';
    label = 'SERVER';
    Icon = Database;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${bg} ${className}`}
      title={
        status === 'CLIENT_CACHE'
          ? 'Served directly from browser TanStack Query memory without network roundtrip'
          : status === 'HIT'
          ? 'Served directly from in-memory Redis cluster'
          : status === 'MISS'
          ? 'Cache miss: queried primary Supabase PostgreSQL database'
          : 'Fail-open Redis degradation bypass'
      }
    >
      {showIcon && <Icon className="w-3 h-3 stroke-[2.5]" />}
      <span>{label}</span>
      {durationMs !== undefined && (
        <span className="opacity-75 font-normal">· {durationMs}ms</span>
      )}
    </span>
  );
};
