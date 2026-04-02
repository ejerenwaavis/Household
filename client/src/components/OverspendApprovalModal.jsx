import { useState } from 'react';
import api from '../services/api';

/**
 * OverspendApprovalModal — manager-only modal to approve or deny an OverspendProject
 * that required approval (memberResponsibilityAmount >= $1000).
 *
 * Props:
 *   project  {object}   — the OverspendProject record
 *   onClose  {fn}       — called when modal should close
 *   onAction {fn(proj)} — called after successful approve/deny with updated project
 */
export default function OverspendApprovalModal({ project, onClose, onAction }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');

  if (!project) return null;

  const progressPct = project.originalChargeAmount > 0
    ? Math.min(100, Math.round((project.totalCollected / project.memberResponsibilityAmount) * 100))
    : 0;

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(
        `/credit-card-statements/${project.householdId}/overspend-projects/${project._id}/approve`,
        { note }
      );
      onAction && onAction(res.data.project);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.patch(
        `/credit-card-statements/${project.householdId}/overspend-projects/${project._id}/status`,
        { status: 'on_hold' }
      );
      onAction && onAction(res.data.project);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Overspend Approval Required</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Review and approve the payment plan for this member</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Member + charge overview */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{project.memberName}</span>
              <span className="text-xs bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                Pending Approval
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Original Charge</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm">${Number(project.originalChargeAmount || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Member Responsibility</p>
                <p className="font-bold text-red-600 dark:text-red-400 text-sm">${Number(project.memberResponsibilityAmount || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Responsibility %</p>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{project.memberResponsibilityPercent || 50}%</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Weekly Payment</p>
                <p className="font-semibold text-gray-800 dark:text-gray-200">${Number(project.weeklyContribution || 0).toFixed(2)}/week</p>
              </div>
            </div>
          </div>

          {/* Payment plan */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Payment Plan — {project.weekCount || 4} weeks</p>
            <div className="space-y-1.5">
              {Array.from({ length: project.weekCount || 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-gray-500 dark:text-gray-400">Week {i + 1}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: progressPct > (i * 25) ? `${Math.min(100, progressPct - i * 25) * 4}%` : '0%' }}
                    />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">${Number(project.weeklyContribution || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note (optional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for the member..."
              className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex gap-3 justify-end border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleDeny}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Put on Hold
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Approving...' : 'Approve Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
