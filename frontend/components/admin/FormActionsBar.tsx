interface FormActionsBarProps {
  onCancel?: () => void;
  onSave?: () => void;
  isLoading?: boolean;
  saveLabel?: string;
}

export function FormActionsBar({
  onCancel,
  onSave,
  isLoading = false,
  saveLabel = "Guardar cambios",
}: FormActionsBarProps) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <button
        type={onSave ? "button" : "submit"}
        onClick={onSave}
        disabled={isLoading}
        className="px-6 py-3 rounded-lg font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition"
      >
        {isLoading ? "Guardando..." : saveLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-6 py-3 rounded-lg font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
