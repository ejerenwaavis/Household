import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import OverspendApprovalModal from './OverspendApprovalModal';
import ProjectDetailView from './ProjectDetailView';

function statusColor(status) {
  if (status === 'active') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (status === 'pending_approval') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
  if (status === 'completed') return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
}

function statusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'pending_approval') return 'Needs Approval';
  if (status === 'completed') return 'Completed';
  if (status === 'on_hold') return 'On Hold';
  return status;
}

export default function OverspendSummaryPanel() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approvalProject, setApprovalProject] = useState(null);
  const [detailProject, setDetailProject] = useState(null);
  const [isManager, setIsManager] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.householdId) return;
    try {
      const [projectsRes, summaryRes, householdRes] = await Promise.all([
        api.get(`/credit-card-statements/${user.householdId}/overspend-projects`),
        api.get(`/credit-card-statements/${user.householdId}/overspend-summary`),
        api.get(`/households/${user.householdId}`),
      ]);
      const all = projectsRes.data?.projects || [];
      // Show only active and pending
      setProjects(all.filter((p) => ['active', 'pending_approval', 'on_hold'].includes(p.status)));
      setSummary(summaryRes.data?.summary || null);

      // Determine if user is manager
      const members = householdRes.data?.members || [];
      const me = members.find((m) => m.userId === user.id);
      setIsManager(['owner', 'co-owner', 'manager'].includes(me?.role));
    } catch (_) {
      // Silent — panel just doesn't render
    } finally {
      setLoading(false);
    }
  }, [user?.householdId, user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleProjectUpdated = (updated) => {
    setProjects((prev) => prev.map((p) => String(p._id) === String(updated._id) ? updated : p));
    setApprovalProject(null);
    fetchData();
  };

  if (loading || (projects.length === 0 && !summary?.activeCount)) return null;

  const pendingApproval = projects.filter((p) => p.status === 'pending_approval');
  const activeProjects = projects.filter((p) => p.status === 'active');
  const totalResponsibility = projects.reduce((sum, p) => sum + (p.memberResponsibilityAmount || 0), 0);
  const totalCollected = projects.reduce((sum, p) => sum + (p.totalCollected || 0), 0);
  const overallProgress = totalResponsibility > 0
    ? Math.round((totalCollected / totalResponsibility) * 100)
    : 0;

  return (
    <>
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <span className="text-base">💳</span>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-1">Overspend Tracker</h3>
          {pendingApproval.length > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium animate-pulse">
              {pendingApproval.length} awaiting approval
            </span>
          )}
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 border-b border-gray-100 dark:border-gray-700">
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{activeProjects.length}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Owed</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">${(totalResponsibility - totalCollected).toFixed(0)}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Collected</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">${totalCollected.toFixed(0)}</p>
            </div>
          </div>
        )}

        {/* Overall progress bar */}
        {totalResponsibility > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Overall progress</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Project list */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {projects.map((project) => {
            const projectProgress = project.memberResponsibilityAmount > 0
              ? Math.min(100, Math.round((project.totalCollected / project.memberResponsibilityAmount) * 100))
              : 0;

            return (
              <div key={String(project._id)} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {(project.memberName || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{project.memberName}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor(project.status)}`}>
                        {statusLabel(project.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ${Number(project.totalCollected || 0).toFixed(2)} / ${Number(project.memberResponsibilityAmount || 0).toFixed(2)} collected
                    </p>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-green-500 transition-all"
                        style={{ width: `${projectProgress}%` }}
                      />
                    </div>

                    {/* Weekly amount */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ${Number(project.weeklyContribution || 0).toFixed(2)}/week · {project.weekCount || 4} weeks
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => setDetailProject(project)}
                      className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      View
                    </button>
                    {isManager && project.status === 'pending_approval' && (
                      <button
                        onClick={() => setApprovalProject(project)}
                        className="text-xs px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval modal */}
      {approvalProject && (
        <OverspendApprovalModal
          project={approvalProject}
          onClose={() => setApprovalProject(null)}
          onAction={handleProjectUpdated}
        />
      )}

      {/* Detail modal */}
      {detailProject && (
        <ProjectDetailView
          project={detailProject}
          isManager={isManager}
          onClose={() => setDetailProject(null)}
          onUpdated={(updated) => {
            handleProjectUpdated(updated);
            setDetailProject(updated);
          }}
        />
      )}
    </>
  );
}
