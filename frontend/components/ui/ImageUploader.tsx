"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface ImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  onUpload: (file: File) => Promise<{ url: string }>;
  label?: string;
  hint?: string;
  accept?: string;
  maxSizeMB?: number;
  shape?: "square" | "circle";
  previewSize?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "w-20 h-20",
  md: "w-32 h-32",
  lg: "w-40 h-40",
};

export function ImageUploader({
  value,
  onChange,
  onUpload,
  label,
  hint,
  accept = "image/*",
  maxSizeMB = 5,
  shape = "square",
  previewSize = "md",
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Solo se permiten imágenes");
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`El archivo supera ${maxSizeMB}MB`);
        return;
      }
      setUploading(true);
      try {
        const result = await onUpload(file);
        onChange(result.url);
      } catch (err: any) {
        setError(err.message || "Error al subir imagen");
      } finally {
        setUploading(false);
      }
    },
    [onUpload, onChange, maxSizeMB]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const roundedClass = shape === "circle" ? "rounded-full" : "rounded-xl";
  const sizeClass = SIZE_MAP[previewSize];

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      )}

      <div className="flex items-start gap-4">
        {/* Preview / Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`${sizeClass} ${roundedClass} border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden flex-shrink-0 ${
            dragOver
              ? "border-indigo-400 bg-indigo-50"
              : value
              ? "border-gray-200 bg-gray-50 hover:border-indigo-300"
              : "border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          ) : value ? (
            <img
              src={value}
              alt="Preview"
              className={`w-full h-full object-cover ${roundedClass}`}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 p-2">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-[10px] text-gray-400 text-center leading-tight">
                Subir
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition disabled:opacity-50"
          >
            {value ? "Cambiar imagen" : "Seleccionar archivo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-sm text-red-500 hover:text-red-600 font-medium transition"
            >
              Eliminar
            </button>
          )}
          {hint && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
