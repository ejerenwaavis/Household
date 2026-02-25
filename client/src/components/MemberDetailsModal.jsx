import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

// Helper function to calculate other members' income percentages
const calculateOtherMembersIncome = (allMembers, currentMemberId) => {
  if (!allMembers || !Array.isArray(allMembers)) return 0;
  return allMembers
    .filter(m => m.userId !== currentMemberId)
    .reduce((sum, m) => sum + (m.incomePercentage || 0), 0);
};

const RESPONSIBILITY_OPTIONS = [
  'utilities',
  'rent_mortgage',
  'groceries',
  'transportation',
  'insurance',
  'childcare',
  'entertainment',
  'healthcare',
  'maintenance_repairs',
  'other'
];

export default function MemberDetailsModal({ member, householdId, allMembers, onClose, onSave }) {
  const { t } = useLanguage();
  const [responsibilities, setResponsibilities] = useState([]);
  const [incomePercentage, setIncomePercentage] = useState(0);
  const [incomeAmount, setIncomeAmount] = useState(0);
  const [memberRole, setMemberRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (member) {
      setResponsibilities(member.responsibilities || []);
      setIncomePercentage(member.incomePercentage || 0);
      setIncomeAmount(member.incomeAmount || 0);
      setMemberRole(member.role || 'member');
    }
  }, [member]);

  const handleToggleResponsibility = (responsibility) => {
    if (responsibilities.includes(responsibility)) {
      setResponsibilities(responsibilities.filter(r => r !== responsibility));
    } else {
      setResponsibilities([...responsibilities, responsibility]);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/households/${householdId}/members/${member.userId}`, {
        role: memberRole,
        responsibilities,
        incomePercentage,
        incomeAmount
      });
      onSave({
        ...member,
        role: memberRole,
        responsibilities,
        incomePercentage,
        incomeAmount
      });
      onClose();
    } catch (err) {
      console.error('[MemberDetailsModal] Error saving:', err);
      setError(err.response?.data?.error || t('Failed to save', 'Error al guardar'));
    } finally {
      setLoading(false);
    }
  };

  const otherMembersIncome = calculateOtherMembersIncome(allMembers, member?.userId);
  const totalIncome = otherMembersIncome + incomePercentage;
  const remainingPercentage = 100 - otherMembersIncome;
  const isOverLimit = totalIncome > 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('Member Details', 'Detalles del Miembro')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{member?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Member Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('Role', 'Función')}
            </label>
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="owner">{t('Owner', 'Propietario')}</option>
              <option value="co-owner">{t('Co-Owner (Spouse)', 'Co-Propietario (Cónyuge)')}</option>
              <option value="manager">{t('Manager', 'Gerente')}</option>
              <option value="member">{t('Member', 'Miembro')}</option>
              <option value="viewer">{t('Viewer', 'Observador')}</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {memberRole === 'owner' 
                ? t('Full access, can manage all members and household settings', 'Acceso completo, puede administrar todos los miembros y configuración')
                : memberRole === 'co-owner'
                ? t('Equal permissions as owner (for spouses or partners)', 'Permisos iguales al propietario (para cónyuges o parejas)')
                : memberRole === 'manager' 
                ? t('Can add expenses for any member and manage household', 'Puede agregar gastos para cualquier miembro y administrar el hogar')
                : memberRole === 'viewer'
                ? t('Can only view household data', 'Solo puede ver datos del hogar')
                : t('Can only add expenses for themselves', 'Solo puede agregar gastos para ellos mismos')}
            </p>
          </div>

          {/* Income Percentage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('Income Percentage', 'Porcentaje de Ingresos')} 
              {otherMembersIncome > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({otherMembersIncome}% {t('already assigned', 'ya asignado')})
                </span>
              )}
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="range"
                min="0"
                max={remainingPercentage}
                value={incomePercentage}
                onChange={(e) => setIncomePercentage(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className={`w-16 px-3 py-2 rounded-lg text-center ${isOverLimit ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <span className={`text-sm font-semibold ${isOverLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {incomePercentage}%
                </span>
              </div>
            </div>
            
            {/* Income allocation visualization */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all" 
                    style={{ width: `${Math.min(otherMembersIncome, 100)}%` }}
                  />
                  <div 
                    className={`h-full ${isOverLimit ? 'bg-red-500' : 'bg-blue-500'} transition-all`}
                    style={{ width: `${Math.min(incomePercentage, remainingPercentage)}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>🟢 {t('Other members', 'Otros miembros')}: {otherMembersIncome}%</span>
                  <span>🔵 {member?.name}: {incomePercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className={isOverLimit ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                    {t('Total', 'Total')}: {totalIncome}%
                  </span>
                  <span>{t('Available', 'Disponible')}: {remainingPercentage}%</span>
                </div>
              </div>
            </div>

            {isOverLimit && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">
                  ⚠️ {t('Income total exceeds 100%', 'El ingreso total excede el 100%')}. {t('Maximum for this member', 'Máximo para este miembro')}: {remainingPercentage}%
                </p>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('Percentage of household income expected from this member', 'Porcentaje de ingresos del hogar esperado de este miembro')}
            </p>
          </div>

          {/* Income Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('Income Amount', 'Monto de Ingresos')} (Optional)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(Number(e.target.value))}
              placeholder={t('Enter amount', 'Ingrese la cantidad')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('Specific amount if different from percentage', 'Cantidad específica si es diferente del porcentaje')}
            </p>
          </div>

          {/* Responsibilities */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('Responsibilities', 'Responsabilidades')}
            </label>
            <div className="space-y-2">
              {RESPONSIBILITY_OPTIONS.map((responsibility) => (
                <label key={responsibility} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={responsibilities.includes(responsibility)}
                    onChange={() => handleToggleResponsibility(responsibility)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t(responsibility.replace(/_/g, ' '), responsibility.replace(/_/g, ' '))}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              {t('Summary', 'Resumen')}
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>• {t('Income Contribution', 'Contribución de Ingresos')}: {incomePercentage}%{incomeAmount > 0 ? ` ($${incomeAmount.toFixed(2)})` : ''}</li>
              <li>• {t('Responsibilities', 'Responsabilidades')}: {responsibilities.length > 0 ? responsibilities.join(', ').replace(/_/g, ' ') : t('None assigned', 'Ninguna asignada')}</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('Cancel', 'Cancelar')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('Saving...', 'Guardando...') : t('Save', 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
