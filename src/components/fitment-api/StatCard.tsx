'use client';

interface StatCardProps {
  value: string;
  label: string;
  sublabel?: string;
}

export function StatCard({ value, label, sublabel }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
      <div className="text-4xl font-bold text-white mb-2">{value}</div>
      <div className="text-zinc-300 font-medium">{label}</div>
      {sublabel && <div className="text-zinc-500 text-sm mt-1">{sublabel}</div>}
    </div>
  );
}
