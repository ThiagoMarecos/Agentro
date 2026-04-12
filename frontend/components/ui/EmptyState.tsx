interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <h3 className="text-lg font-display font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-400 text-sm mb-4 max-w-sm mx-auto">{description}</p>
      )}
      {action}
    </div>
  );
}
