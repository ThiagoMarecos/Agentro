"use client";

interface ColorInputRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorInputRow({ label, value, onChange }: ColorInputRowProps) {
  const hexMatch = value.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
  const displayValue = hexMatch ? value : "#6366F1";

  return (
    <div className="flex items-center gap-4">
      <label className="w-28 text-sm text-gray-500 font-medium">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6366F1"
          className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm font-mono text-gray-700"
        />
      </div>
    </div>
  );
}
