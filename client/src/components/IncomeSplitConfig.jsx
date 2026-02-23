import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function IncomeSplitConfig({ householdId, onUpdate }) {
  const { t } = useLanguage();
  const [splits, setSplits] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newPercentage, setNewPercentage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSplits();
  }, [householdId]);

  const fetchSplits = async () => {
    if (!householdId) return;
    try {
      const res = await api.get(`/income-splits/${householdId}`);
      setSplits(res.data.splits || []);
      console.log('[IncomeSplitConfig] fetched splits:', res.data.splits);
    } catch (err) {
      console.error('[IncomeSplitConfig] fetch error:', err);
    }
  };

  const handleEditStart = (split) => {
    setEditing(split);
    setNewPercentage(split.splitPercentage);
  };

  const handleSave = async () => {
    if (!newPercentage || Number(newPercentage) < 0 || Number(newPercentage) > 100) {
      alert(t('Enter a valid percentage between 0 and 100', 'Ingresa un porcentaje válido entre 0 y 100'));
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/income-splits/${householdId}/${editing.userId._id || editing.userId}`, {
        splitPercentage: Number(newPercentage),
      });
      setEditing(null);
      await fetchSplits();
      onUpdate && onUpdate();
    } catch (err) {
      console.error('[IncomeSplitConfig] save error:', err);
      alert(err?.response?.data?.error || t('Failed to save', 'Error al guardar'));
    } finally {
      setLoading(false);
    }
  };

  const totalSplit = splits.reduce((sum, s) => sum + (s.splitPercentage || 0), 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        {t('Income Split Configuration', 'Configuración de División de Ingresos')}
      </h3>

      <div className="space-y-3">
        {splits.map((split) => (
          <div key={split._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {split.userId.name || split.userName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {split.isHeadOfHouse && (
                  <span className="inline-block mr-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                    {t('Head of House', 'Jefe de Hogar')}
                  </span>
                )}
              </div>
            </div>

            {editing?._id === split._id ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newPercentage}
                  onChange={(e) => setNewPercentage(e.target.value)}
                  className="w-20 p-2 border rounded text-sm"
                  placeholder="%"
                />
                <span className="text-sm">%</span>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-60"
                >
                  {loading ? t('Saving...', 'Guardando...') : t('Save', 'Guardar')}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="px-3 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                >
                  {t('Cancel', 'Cancelar')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold text-indigo-600 w-12 text-right">
                  {split.splitPercentage}%
                </div>
                <button
                  onClick={() => handleEditStart(split)}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  {t('Edit', 'Editar')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-300">{t('Total Split', 'División Total')}</span>
          <span className={`font-bold ${totalSplit === 100 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {totalSplit}%
          </span>
        </div>
        {totalSplit !== 100 && (
          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
            {t('Note: Total should equal 100%', 'Nota: El total debe ser 100%')}
          </div>
        )}
      </div>
    </div>
  );
}
