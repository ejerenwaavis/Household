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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
        <div>
          <h4 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h4>
          <p className={`mt-1 text-xl sm:text-2xl font-semibold ${valueClass}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-lg text-white ${accentClass} ${isClickable ? 'group' : ''}`}>
          {isClickable ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20v-4" />
            </svg>
          )}
        </div>
      </div>
      {subtitle && <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
    </div>
  );
}
