import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MetricCard({ title, value, subtitle, accent, valueColor, linkTo, onClick }){
  const navigate = useNavigate();
  const accentClass = accent || 'bg-indigo-500';
  const valueClass = valueColor || 'text-gray-700 dark:text-gray-300';

  const handleClick = () => {
    if (onClick) onClick();
    else if (linkTo) navigate(linkTo);
  };

  const isClickable = linkTo || onClick;

  return (
    <div className={`bg-white dark:bg-gray-750 rounded-2xl p-4 sm:p-5 shadow-md border border-gray-200 dark:border-gray-700 ${isClickable ? 'cursor-pointer hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all' : ''}`} onClick={handleClick}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h4>
          <p className={`mt-1 text-xl sm:text-2xl font-semibold ${valueClass}`}>{value}</p>
          {subtitle && <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
        </div>
        {isClickable && (
          <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs transition-colors">
            <span className="hidden sm:inline">View</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
