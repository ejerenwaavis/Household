import React from 'react';

export default function SimpleBarChart({ data = [], labels = [], title }){
  const max = Math.max(...data, 1);
  return (
    <div className="bg-white dark:bg-gray-750 rounded-2xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-3">
        {title || `Last ${data.length} points`}
      </div>
      <div className="flex items-end h-44 space-x-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1">
            <div className="h-full flex items-end">
              <div title={`${labels[i] || i}: ${d}`} style={{ height: `${(d / max) * 100}%` }} className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md"></div>
            </div>
            <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">{labels[i] ? labels[i].slice(0,3) : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
