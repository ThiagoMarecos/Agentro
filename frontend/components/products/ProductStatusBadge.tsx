interface ProductStatusBadgeProps {
  status: string;
}

export function ProductStatusBadge({ status }: ProductStatusBadgeProps) {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border border-green-200",
    draft: "bg-amber-50 text-amber-700 border border-amber-200",
    archived: "bg-gray-100 text-gray-500 border border-gray-200",
  };
  const labels: Record<string, string> = {
    active: "Activo",
    draft: "Borrador",
    archived: "Archivado",
  };
  const style = styles[status] || "bg-gray-100 text-gray-500 border border-gray-200";
  const label = labels[status] || status;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
