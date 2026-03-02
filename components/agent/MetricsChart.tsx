'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MetricDataPoint {
    timestamp: string;
    cpuUsage: number;
    ramUsage: number;
    diskUsage: number;
    networkUp: number;
    networkDown: number;
}

interface MetricsChartProps {
    data: MetricDataPoint[];
    timeRange: '1h' | '24h' | '7d' | '30d';
}

export default function MetricsChart({ data, timeRange }: MetricsChartProps) {
    // Format timestamp based on time range
    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);

        switch (timeRange) {
            case '1h':
            case '24h':
                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            case '7d':
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            case '30d':
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            default:
                return timestamp;
        }
    };

    // Transform data for chart
    const chartData = data.map((point) => ({
        time: formatTimestamp(point.timestamp),
        CPU: point.cpuUsage,
        RAM: point.ramUsage,
        Disk: point.diskUsage,
    }));

    return (
        <div className="space-y-8">
            {/* System Resources Chart */}
            <div>
                <h3 className="text-lg font-semibold mb-4">System Resources</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="time"
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                            domain={[0, 100]}
                            label={{ value: 'Usage (%)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                padding: '12px',
                                color: '#e2e8f0'
                            }}
                            formatter={((value: string | number | undefined) => `${Number(value ?? 0).toFixed(1)}%`) as never}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="CPU"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="RAM"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="Disk"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Network Activity Chart */}
            <div>
                <h3 className="text-lg font-semibold mb-4">Network Activity</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={data.map((point) => ({
                        time: formatTimestamp(point.timestamp),
                        Upload: point.networkUp,
                        Download: point.networkDown,
                    }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="time"
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                            label={{ value: 'KB/s', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                padding: '12px',
                                color: '#e2e8f0'
                            }}
                            formatter={((value: string | number | undefined) => `${Number(value ?? 0).toFixed(1)} KB/s`) as never}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="Upload"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="Download"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
