import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

const RECOMMENDATION_STYLES = {
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300',
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400',
  danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-400',
};

const ICONS = {
  warning: '⚠️',
  success: '✅',
  info: '💡',
  danger: '🚨',
};

function MetricCard({ label, value, subtitle, color = 'purple' }) {
  const colors = {
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${colors[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function CategoryBar({ category, amount, percentage }) {
  const fmt = (v) => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700 dark:text-gray-300 font-medium">{category}</span>
        <span className="text-gray-600 dark:text-gray-400">{fmt(amount)} <span className="text-xs text-gray-400">({percentage.toFixed(1)}%)</span></span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('/insights');
      setInsights(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('upgrade_required');
      } else {
        setError(err.response?.data?.error || 'Failed to load insights.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/insights/refresh');
      await loadInsights();
    } catch (err) {
      if (err.response?.status === 403) {
        setError('upgrade_required');
      } else {
        setError(err.response?.data?.error || 'Failed to refresh insights.');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    if (!insights) return;
    const blob = new Blob([JSON.stringify(insights, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insights-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error === 'upgrade_required') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">AI Insights Require a Paid Plan</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Unlock spending analysis, budget recommendations, and anomaly detection with a Basic plan or higher.</p>
          <a href="/pricing" className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors">
            View Plans
          </a>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button onClick={loadInsights} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold">Try Again</button>
        </div>
      </Layout>
    );
  }

  const d = insights?.insights || {};
  const metrics = d.metrics || {};
  const patterns = d.spendingPatterns || {};
  const recommendations = d.budgetRecommendations || [];
  const anomalies = d.anomalies || [];
  const aiSummary = d.aiSummary;
  const generatedAt = d.generatedAt ? new Date(d.generatedAt).toLocaleString() : null;
  const topCategories = patterns.topCategories || [];

  const fmt = (v) => {
    if (v == null) return '—';
    return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const savingsRate = metrics.savingsRate != null ? `${metrics.savingsRate.toFixed(1)}%` : '—';
  const savingsColor = (metrics.savingsRate ?? 0) >= 20 ? 'green' : (metrics.savingsRate ?? 0) >= 10 ? 'blue' : 'red';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Financial Insights</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {generatedAt ? `Last updated ${generatedAt}` : 'Powered by Smart Analysis'}
              {d.aiEnhanced && <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 rounded-full text-xs font-medium">✨ AI Enhanced</span>}
              {d.aiEnabled && !d.aiEnhanced && <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">💡 Smart Analysis</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              Export
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {refreshing ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Income" value={fmt(metrics.totalIncome)} color="green" />
          <MetricCard label="Total Expenses" value={fmt(metrics.totalExpenses)} color="red" />
          <MetricCard label="Net Savings" value={fmt(metrics.netSavings)} color={(metrics.netSavings ?? 0) >= 0 ? 'green' : 'red'} />
          <MetricCard label="Savings Rate" value={savingsRate} subtitle="Target: 20%+" color={savingsColor} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Spending by Category */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Top Spending Categories</h2>
            {topCategories.length === 0 ? (
              <p className="text-gray-400 text-sm">No category data yet. Add some transactions to see your spending breakdown.</p>
            ) : (
              topCategories.slice(0, 6).map((cat) => (
                <CategoryBar
                  key={cat.category}
                  category={cat.category}
                  amount={cat.total}
                  percentage={cat.percentage}
                />
              ))
            )}
          </div>

          {/* Monthly Trend */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Monthly Trend</h2>
            {!patterns.monthlyTrend?.length ? (
              <p className="text-gray-400 text-sm">Not enough transaction history to show trends yet.</p>
            ) : (
              <div className="space-y-2">
                {patterns.monthlyTrend.slice(0, 6).map((month) => {
                  const net = (month.income || 0) - (month.expenses || 0);
                  return (
                    <div key={month.month} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400 w-20">{month.month}</span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-green-600 dark:text-green-400">{fmt(month.income)}</span>
                        <span className="text-red-500 dark:text-red-400">-{fmt(month.expenses)}</span>
                      </div>
                      <span className={`font-semibold text-xs ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {net >= 0 ? '+' : ''}{fmt(net)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* AI Summary */}
        {aiSummary && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{d.aiEnhanced ? '🤖' : '💡'}</span>
              <h2 className="text-lg font-bold text-purple-900 dark:text-purple-300">{d.aiEnhanced ? 'AI Financial Summary' : 'Smart Financial Summary'}</h2>
            </div>
            {aiSummary.summary && (
              <p className="text-purple-900 dark:text-purple-200 text-sm leading-relaxed mb-4">{aiSummary.summary}</p>
            )}
            {aiSummary.insights?.length > 0 && (
              <div className="space-y-2">
                {aiSummary.insights.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-purple-800 dark:text-purple-300">
                    <span>{item.emoji || '💡'}</span>
                    <div><span className="font-semibold">{item.title}: </span>{item.insight}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Budget Recommendations */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Budget Recommendations</h2>
          {recommendations.length === 0 ? (
            <p className="text-gray-400 text-sm">No recommendations yet. Link accounts and add transactions to get personalized advice.</p>
          ) : (
            <div className="space-y-3">
              {recommendations.slice(0, 8).map((rec, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 border rounded-lg text-sm ${RECOMMENDATION_STYLES[rec.type] || RECOMMENDATION_STYLES.info}`}>
                  <span>{ICONS[rec.type] || '💡'}</span>
                  <div>
                    <p className="font-semibold">{rec.message}</p>
                    {rec.category && <p className="text-xs opacity-75 mt-0.5">Category: {rec.category}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Anomalies */}
        {anomalies.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">🚨 Unusual Transactions</h2>
            <div className="space-y-3">
              {anomalies.map((anomaly, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm">
                  <span>⚡</span>
                  <div>
                    <p className="font-semibold text-orange-900 dark:text-orange-300">{anomaly.description}</p>
                    {anomaly.amount && (
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">Amount: {fmt(anomaly.amount)} · {anomaly.category}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state - only show when no AI summary was generated */}
        {!d.aiEnabled && !metrics.totalIncome && !metrics.totalExpenses && recommendations.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-lg font-medium text-gray-600 dark:text-gray-400">No data to analyze yet</p>
            <p className="text-sm mt-2">Link your bank accounts and add transactions to get started.</p>
            <a href="/linked-accounts" className="inline-block mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors">
              Link an Account
            </a>
          </div>
        )}
      </div>
    </Layout>
  );
}
