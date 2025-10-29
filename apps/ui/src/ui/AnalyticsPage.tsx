import { useEffect, useState, useMemo } from 'react';
import { getBacklog, getSchedule, ScheduleEntry } from '../client/api';
import { classifyProcedure } from './procedureGroups';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export function AnalyticsPage() {
  const [backlogItems, setBacklogItems] = useState<any[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const backlog = await getBacklog();
        const schedule = await getSchedule();
        setBacklogItems(backlog);
        setScheduleItems(schedule || []);
      } catch (e) {
        console.error('Failed to load analytics data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filter by date range
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const filteredSchedule = useMemo(() => {
    return scheduleItems.filter((item) => {
      if (dateRange === 'all') return true;
      const itemDate = new Date(item.date);
      if (dateRange === 'week') return itemDate >= weekAgo;
      if (dateRange === 'month') return itemDate >= monthAgo;
      return true;
    });
  }, [scheduleItems, dateRange]);

  // Calculate metrics
  const activeCount = backlogItems.length;
  const confirmedCount = filteredSchedule.filter((s) => s.status === 'confirmed').length;
  const operatedCount = filteredSchedule.filter((s) => s.status === 'operated').length;
  const totalCount = activeCount + confirmedCount + operatedCount;

  // Category distribution (from backlog items)
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of backlogItems) {
      const key = item.categoryKey || classifyProcedure(item.procedure);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name: formatCategoryName(name),
      value,
    }));
  }, [backlogItems]);

  // Case status distribution
  const statusData = useMemo(() => {
    return [
      { name: 'Active', value: activeCount, color: '#3b82f6' },
      { name: 'Confirmed', value: confirmedCount, color: '#f59e0b' },
      { name: 'Operated', value: operatedCount, color: '#10b981' },
    ].filter((d) => d.value > 0);
  }, [activeCount, confirmedCount, operatedCount]);

  // Priority distribution (from backlog)
  const priorityData = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of backlogItems) {
      const priority = item.caseTypeId === 'case:emergency' ? 'Emergency' : item.caseTypeId === 'case:urgent' ? 'Urgent' : 'Elective';
      map.set(priority, (map.get(priority) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [backlogItems]);

  const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1'];
  const STATUS_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
        <div>Loading analytics…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24, padding: '16px' }}>
      <div>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Analytics Dashboard</h2>

        {/* Date Range Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setDateRange('week')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: dateRange === 'week' ? '2px solid #3b82f6' : '1px solid var(--border)',
              background: dateRange === 'week' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            This Week
          </button>
          <button
            onClick={() => setDateRange('month')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: dateRange === 'month' ? '2px solid #3b82f6' : '1px solid var(--border)',
              background: dateRange === 'month' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            This Month
          </button>
          <button
            onClick={() => setDateRange('all')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: dateRange === 'all' ? '2px solid #3b82f6' : '1px solid var(--border)',
              background: dateRange === 'all' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            All Time
          </button>
        </div>

        {/* Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <MetricCard title="Active Cases" value={activeCount} color="#3b82f6" />
          <MetricCard title="Confirmed Cases" value={confirmedCount} color="#f59e0b" />
          <MetricCard title="Operated Cases" value={operatedCount} color="#10b981" />
          <MetricCard title="Total Cases" value={totalCount} color="#8b5cf6" />
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, marginBottom: 32 }}>
          {/* Category Distribution */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-1)' }}>
            <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 16 }}>Cases by Category</h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={renderLabel} outerRadius={100} fill="#8884d8" dataKey="value">
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 300, display: 'grid', placeItems: 'center', opacity: 0.5 }}>No data</div>
            )}
          </div>

          {/* Case Status Distribution */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-1)' }}>
            <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 16 }}>Cases by Status</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={renderLabel} outerRadius={100} fill="#8884d8" dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 300, display: 'grid', placeItems: 'center', opacity: 0.5 }}>No data</div>
            )}
          </div>

          {/* Priority Distribution */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-1)' }}>
            <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 16 }}>Cases by Priority</h3>
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={priorityData} cx="50%" cy="50%" labelLine={false} label={renderLabel} outerRadius={100} fill="#8884d8" dataKey="value">
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 300, display: 'grid', placeItems: 'center', opacity: 0.5 }}>No data</div>
            )}
          </div>
        </div>

        {/* Statistics Table */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-1)' }}>
          <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 16 }}>Detailed Breakdown by Category</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>Category</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)' }}>Active</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)' }}>Confirmed</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)' }}>Operated</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((cat, idx) => {
                const activeInCat = backlogItems.filter((item) => (item.categoryKey || classifyProcedure(item.procedure)) === cat.name.toLowerCase().replace(/\s+/g, '')).length;
                return (
                  <tr key={idx}>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{cat.name}</td>
                    <td style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)' }}>{activeInCat}</td>
                    <td style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)' }}>—</td>
                    <td style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)' }}>—</td>
                    <td style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{cat.value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-1)' }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 600, color }}>
        {value}
      </div>
    </div>
  );
}

function renderLabel(entry: any) {
  return `${entry.name} (${entry.value})`;
}

function formatCategoryName(key: string): string {
  const map: Record<string, string> = {
    dental: 'Dental',
    minorPath: 'Minor Pathology',
    majorPath: 'Major Pathology',
    tmj: 'TMJ',
    orthognathic: 'Orthognathic',
    uncategorized: 'Uncategorized',
  };
  return map[key] || key;
}
