import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const TYPES = ['Emergency', 'Project', 'Investment', 'Other'];

const typeLabel = (t, tp) =>
  t(tp, tp === 'Emergency' ? 'Emergencia' : tp === 'Project' ? 'Proyecto' : tp === 'Investment' ? 'Inversión' : 'Otro');

export default function EditGoalModal({ goal, linkedAccounts = [], onSave, onClose }) {
  const { t } = useLanguage();
  const [name, setName] = useState(goal?.name || '');
  const [type, setType] = useState(goal?.type || 'Other');
  const [monthlyContribution, setMonthlyContribution] = useState(goal?.monthlyContribution ?? 0);
  const [target, setTarget] = useState(goal?.target ?? 0);
  const [currentBalance, setCurrentBalance] = useState(goal?.currentBalance ?? 0);
  const [linkedAccountId, setLinkedAccountId] = useState(goal?.linkedAccountId || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        monthlyContribution: Number(monthlyContribution),
        target: Number(target),
        currentBalance: Number(currentBalance),
        linkedAccountId: linkedAccountId || null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{t('Edit Goal', 'Editar Meta')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500">{t('Goal Name', 'Nombre del Objetivo')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Type', 'Tipo')}</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>{typeLabel(t, tp)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Monthly Contribution', 'Aportación Mensual')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Target Amount', 'Monto Objetivo')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Current Balance', 'Saldo Actual')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Linked bank account */}
          <div>
            <label className="block text-xs text-gray-500">
              {t('Linked Bank Account', 'Cuenta Bancaria Vinculada')}{' '}
              <span className="text-gray-400">({t('optional', 'opcional')})</span>
            </label>
            {linkedAccounts.length === 0 ? (
              <p className="mt-1 text-xs text-gray-400 italic">
                {t('No linked accounts — connect a bank account first.', 'Sin cuentas vinculadas — conecta tu banco primero.')}
              </p>
            ) : (
              <select
                value={linkedAccountId}
                onChange={(e) => setLinkedAccountId(e.target.value)}
                className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">{t('— No linked account —', '— Sin cuenta vinculada —')}</option>
                {linkedAccounts.map((acct) => (
                  <option key={acct._id} value={acct._id}>
                    🏦 {acct.institutionName || acct.accountName}
                    {acct.accountMask ? ` ••${acct.accountMask}` : ''}
                    {acct.accountSubtype ? ` (${acct.accountSubtype})` : ''}
                    {typeof acct.currentBalance === 'number' ? ` — $${acct.currentBalance.toFixed(2)}` : ''}
                  </option>
                ))}
              </select>
            )}
            {linkedAccountId && (() => {
              const acct = linkedAccounts.find(a => a._id === linkedAccountId);
              return acct ? (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                  {t('Bank balance', 'Saldo bancario')}: <strong>${(acct.currentBalance || 0).toFixed(2)}</strong>
                  {' · '}{t('Save to sync this goal\'s balance from that account.', 'Guarda para sincronizar el saldo de esta meta desde esa cuenta.')}
                </p>
              ) : null;
            })()}
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
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {loading ? t('Saving...', 'Guardando...') : t('Save', 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
