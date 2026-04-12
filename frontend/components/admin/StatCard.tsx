import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  icon?: LucideIcon;
}

export function StatCard({ label, value, trend, icon: Icon }: StatCardProps) {
  return (
    <div className="p-5 rounded-xl bg-white border border-gray-200/60 hover:shadow-md hover:shadow-gray-100 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && <p className="text-sm text-green-600 mt-1">{trend}</p>}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
