/**
 * StatsPanel Component
 * 
 * Displays vocabulary statistics and generation progress.
 */

import React, { memo, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import {
    BookOpen,
    MessageSquare,
    Percent,
    Activity,
    TrendingUp,
    Layers
} from 'lucide-react';

/**
 * POS colors for charts
 */
const POS_CHART_COLORS = {
    n: '#3B82F6', // blue
    v: '#10B981', // green
    j: '#8B5CF6', // purple
    r: '#F59E0B', // amber
    i: '#EC4899', // pink
    p: '#06B6D4', // cyan
    c: '#6366F1', // indigo
    other: '#6B7280', // gray
};

/**
 * Stat card component
 */
const StatCard = memo(function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    color = 'primary'
}) {
    const colorClasses = {
        primary: 'bg-primary-50 text-primary-600',
        green: 'bg-green-50 text-green-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    {subValue && (
                        <p className="text-xs text-gray-400">{subValue}</p>
                    )}
                </div>
            </div>
        </div>
    );
});

/**
 * Progress bar component
 */
const ProgressBar = memo(function ProgressBar({
    value,
    max = 100,
    label,
    showPercentage = true
}) {
    const percentage = Math.round((value / max) * 100);

    return (
        <div className="space-y-1">
            {label && (
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    {showPercentage && (
                        <span className="text-gray-500">{percentage}%</span>
                    )}
                </div>
            )}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
});

/**
 * StatsPanel component
 */
const StatsPanel = memo(function StatsPanel({
    stats,
    loading = false,
    showCharts = true,
    compact = false,
}) {
    // Prepare POS data for charts
    const posChartData = useMemo(() => {
        if (!stats?.pos_distribution) return [];

        return Object.entries(stats.pos_distribution)
            .map(([pos, count]) => ({
                name: pos.toUpperCase(),
                value: count,
                color: POS_CHART_COLORS[pos.toLowerCase()] || POS_CHART_COLORS.other,
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // Top 8 POS types
    }, [stats]);

    // Coverage percentage
    const coveragePercentage = useMemo(() => {
        if (!stats) return 0;
        const total = stats.total_words || 0;
        const withSentences = stats.words_with_sentences || 0;
        return total > 0 ? Math.round((withSentences / total) * 100) : 0;
    }, [stats]);

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-gray-500">
                No statistics available
            </div>
        );
    }

    // Compact view
    if (compact) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">
                                <span className="font-medium">{stats.total_words?.toLocaleString()}</span>
                                <span className="text-gray-500"> words</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">
                                <span className="font-medium">{stats.total_sentences?.toLocaleString()}</span>
                                <span className="text-gray-500"> sentences</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">
                                <span className="font-medium">{coveragePercentage}%</span>
                                <span className="text-gray-500"> coverage</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Full view
    return (
        <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={BookOpen}
                    label="Total Words"
                    value={stats.total_words}
                    color="blue"
                />
                <StatCard
                    icon={MessageSquare}
                    label="Total Sentences"
                    value={stats.total_sentences}
                    color="green"
                />
                <StatCard
                    icon={Activity}
                    label="Coverage"
                    value={`${coveragePercentage}%`}
                    subValue={`${stats.words_with_sentences?.toLocaleString()} words`}
                    color="purple"
                />
                <StatCard
                    icon={Layers}
                    label="Avg Sentences/Word"
                    value={stats.avg_sentences_per_word?.toFixed(1) || '0'}
                    color="amber"
                />
            </div>

            {/* Coverage progress */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Sentence Generation Progress
                </h3>
                <ProgressBar
                    value={stats.words_with_sentences || 0}
                    max={stats.total_words || 1}
                    label={`${stats.words_with_sentences?.toLocaleString()} of ${stats.total_words?.toLocaleString()} words`}
                />
            </div>

            {/* Charts */}
            {showCharts && posChartData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Bar Chart */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                            Words by Part of Speech
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={posChartData} layout="vertical">
                                    <XAxis type="number" />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={40}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip
                                        formatter={(value) => [value.toLocaleString(), 'Words']}
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: 'none',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                        }}
                                    />
                                    <Bar
                                        dataKey="value"
                                        radius={[0, 4, 4, 0]}
                                    >
                                        {posChartData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                            POS Distribution
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={posChartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={({ name, percent }) =>
                                            `${name} ${(percent * 100).toFixed(0)}%`
                                        }
                                        labelLine={false}
                                    >
                                        {posChartData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => [value.toLocaleString(), 'Words']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Theme breakdown if available */}
            {stats.themes && Object.keys(stats.themes).length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Sentences by Theme
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Object.entries(stats.themes).map(([theme, count]) => (
                            <div key={theme} className="text-center p-3 bg-gray-50 rounded-lg">
                                <div className="text-lg font-bold text-gray-900">
                                    {count.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500 capitalize">
                                    {theme.replace('_', ' ')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

export default StatsPanel;
