import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function FixedExpensePaymentsWidget({ currentMonth, payments = [], totalFixed = 0 }) {
  const { t } = useLanguage();

  const paidAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingAmount = Math.max(0, totalFixed - paidAmount);
  const progressPercent = totalFixed > 0 ? Math.round((paidAmount / totalFixed) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-600">
            {t('Fixed Expenses Progress', 'Progreso de Gastos Fijos')}
          </h3>
          <span className="text-xs text-gray-400">{currentMonth || 'This Month'}</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1.5">
            <span>
              {t('Paid', 'Pagado')}: <span className="font-medium text-gray-800">${paidAmount.toFixed(2)}</span>
            </span>
            <span>
              {t('of', 'de')} <span className="font-medium text-gray-800">${totalFixed.toFixed(2)}</span> • {progressPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Summary boxes */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="text-xs text-green-600">{t('Paid', 'Pagado')}</div>
            <div className="text-lg font-bold text-green-700">${paidAmount.toFixed(2)}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <div className="text-xs text-orange-600">{t('Remaining', 'Pendiente')}</div>
            <div className="text-lg font-bold text-orange-700">${remainingAmount.toFixed(2)}</div>
          </div>
        </div>

        {/* Status message */}
        <div className="text-xs text-gray-500 pt-2">
          {remainingAmount === 0 ? (
            <span className="text-green-600 font-medium">✓ {t('All fixed expenses paid this month!', '¡Todos los gastos fijos pagados este mes!')}</span>
          ) : (
            <span>{t('Remaining to pay this month', 'Pendiente de pagar este mes')}: ${remainingAmount.toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
