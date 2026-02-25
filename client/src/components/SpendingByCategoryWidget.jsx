import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const CATEGORY_COLORS = {
  groceries: '#10b981',      // Green
  transportation: '#f59e0b', // Amber
  utilities: '#3b82f6',      // Blue
  entertainment: '#ec4899',  // Pink
  healthcare: '#ef4444',     // Red
  dining: '#f97316',         // Orange
  shopping: '#a855f7',       // Purple
  insurance: '#06b6d4',      // Cyan
  childcare: '#14b8a6',      // Teal
  maintenance_repairs: '#6366f1', // Indigo
  other: '#6b7280'           // Gray
};

export default function SpendingByCategoryWidget({ expenses = [] }) {
  const { t } = useLanguage();

  // Group expenses by category
  const categoryTotals = {};
  expenses.forEach(exp => {
    const category = exp.category || 'other';
    categoryTotals[category] = (categoryTotals[category] || 0) + (exp.amount || 0);
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6); // Top 6 categories

  const totalSpending = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  if (totalSpending === 0) {
    return (
      <div className="bg-white dark:bg-gray-750 rounded-2xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-4">{t('Spending by Category', 'Gastos por Categoría')}</h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          {t('No spending data yet', 'Sin datos de gastos aún')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-750 rounded-2xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('Spending by Category', 'Gastos por Categoría')}</h3>
        <span className="text-lg font-bold text-gray-900 dark:text-white">${totalSpending.toFixed(2)}</span>
      </div>

      <div className="space-y-3">
        {sortedCategories.map(([category, amount]) => {
          const percentage = (amount / totalSpending) * 100;
          const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;

          return (
            <div key={category}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700 dark:text-gray-300 capitalize">
                  {category.replace(/_/g, ' ')}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ${amount.toFixed(2)} <span className="text-gray-400 dark:text-gray-500">({percentage.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percentage}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(categoryTotals).length > 6 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
          +{Object.keys(categoryTotals).length - 6} {t('more categories', 'más categorías')}
        </div>
      )}
    </div>
  );
}
