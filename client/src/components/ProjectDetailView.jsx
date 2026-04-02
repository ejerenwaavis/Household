import { useState } from 'react';
import PaymentRecordingForm from './PaymentRecordingForm';

function statusColor(status) {
  if (status === 'active') return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
  if (status === 'pending_approval') return 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
  if (status === 'completed') return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
  if (status === 'on_hold') return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
  return '';
}

/**
 * ProjectDetailView — modal showing full overspend project details,
 * payment history, and allowing managers to record new payments.
 *
 * Props:
 *   project    {object}   — OverspendProject
 *   isManager  {boolean}  — whether current user can record payments
 *   onClose    {fn}
 *   onUpdated  {fn(proj)} — called when project is updated
 */
export default function ProjectDetailView({ project, isManager, onClose, onUpdated }) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  if (!project) return null;

  const progressPct = project.memberResponsibilityAmount > 0
    ? Math.min(100, Math.round((project.totalCollected / project.memberResponsibilityAmount) * 100))
    : 0;

  const remaining = Math.max(0, project.memberResponsibilityAmount - project.totalCollected);
  const payments = project.payments || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden my-auto">

        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-orange-400 to-red-500" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Overspend Project</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-gray-500 dark:text-gray-400">{project.memberName}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(project.status)}`}>
                {project.status?.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Original Charge</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">${Number(project.originalChargeAmount || 0).toFixed(2)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Member Responsibility</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">${Number(project.memberResponsibilityAmount || 0).toFixed(2)}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Collected</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">${Number(project.totalCollected || 0).toFixed(2)}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">${remaining.toFixed(2)}</p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Payment progress</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{progressPct}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Weekly schedule */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Weekly Schedule</p>
            <div className="space-y-2">
              {Array.from({ length: project.weekCount || 4 }).map((_, i) => {
                const weekNum = i + 1;
                const payment = payments.find((p) => p.week === weekNum);
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-xs ${
                    payment
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      payment ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                    }`}>
                      {payment ? '✓' : weekNum}
                    </span>
                    <span className="flex-1 font-medium text-gray-700 dark:text-gray-300">Week {weekNum}</span>
                    {payment ? (
                      <div className="text-right">
                        <p className="font-semibold text-green-700 dark:text-green-400">${Number(payment.amount).toFixed(2)} paid</p>
                        <p className="text-gray-400 dark:text-gray-500">{new Date(payment.date).toLocaleDateString()}</p>
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">${Number(project.weeklyContribution || 0).toFixed(2)} due</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project metadata */}
          {project.description && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Description</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{project.description}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
            {project.approvalDate && <span>Approved: {new Date(project.approvalDate).toLocaleDateString()}</span>}
          </div>

          {/* Payment form (managers only, active projects) */}
          {isManager && project.status === 'active' && remaining > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              {!showPaymentForm ? (
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="w-full py-2 px-4 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm"
                >
                  + Record Payment
                </button>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Record Payment</p>
                  <PaymentRecordingForm
                    project={project}
                    onSuccess={(updated) => {
                      setShowPaymentForm(false);
                      onUpdated && onUpdated(updated);
                    }}
                    onCancel={() => setShowPaymentForm(false)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
