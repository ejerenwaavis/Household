import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function EditIncomeModal({ income, members = [], onSave, onClose }){
  const { t } = useLanguage();
  const [amount, setAmount] = useState(income?.amount || (Array.isArray(income?.dailyBreakdown) && income?.dailyBreakdown[0]?.amount) || 0);
  const [contributorName, setContributorName] = useState(income?.contributorName || '');
  const [source, setSource] = useState(income?.source || (Array.isArray(income?.dailyBreakdown) && income?.dailyBreakdown[0]?.source) || 'Salary');
  const [description, setDescription] = useState(income?.description || (Array.isArray(income?.dailyBreakdown) && income?.dailyBreakdown[0]?.description) || '');
  const [loading, setLoading] = useState(false);

  const sources = ['Salary', 'Freelance', 'Interest', 'Other'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updates = {
        amount: Number(amount),
        contributorName,
        source,
        description,
      };
      await onSave(updates);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">{t('Edit Income Entry', 'Editar Entrada de Ingreso')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500">{t('Amount', 'Monto')}</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Contributor Name', 'Nombre del Contribuyente')}</label>
            <select
              value={contributorName}
              onChange={(e) => setContributorName(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            >
              <option value="">-- {t('Select', 'Seleccionar')} --</option>
              {members.map((m) => (
                <option key={m.userId || m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Source', 'Fuente')}</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
              {sources.map((s) => (
                <option key={s} value={s}>{t(s, s === 'Salary' ? 'Salario' : s === 'Freelance' ? 'Freelance' : s === 'Interest' ? 'Interés' : 'Otro')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Description', 'Descripción')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('Optional', 'Opcional')}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {t('Cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {loading ? t('Saving...', 'Guardando...') : t('Save', 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
