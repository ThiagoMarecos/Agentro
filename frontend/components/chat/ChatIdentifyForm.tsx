"use client";

import { useState } from "react";
import { MessageCircle, ArrowRight } from "lucide-react";

interface ChatIdentifyFormProps {
  storeName: string;
  primaryColor: string;
  onIdentify: (name: string, email: string) => void;
}

export function ChatIdentifyForm({
  storeName,
  primaryColor,
  onIdentify,
}: ChatIdentifyFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onIdentify(name.trim(), email.trim());
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full">
        {/* Icon & Title */}
        <div className="text-center mb-10">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white shadow-lg"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 8px 24px -4px ${primaryColor}40`,
            }}
          >
            <MessageCircle className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Chatea con {storeName}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
            Nuestro asistente IA esta listo para ayudarte con productos,
            consultas y mas.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Tu nombre{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan"
              className="w-full px-5 py-3.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Tu email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full px-5 py-3.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:brightness-110 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 4px 14px -2px ${primaryColor}50`,
            }}
          >
            Iniciar chat
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-[11px] text-gray-400 text-center pt-1">
            Tu email nos ayuda a darte un mejor servicio. No spam.
          </p>
        </form>
      </div>
    </div>
  );
}
