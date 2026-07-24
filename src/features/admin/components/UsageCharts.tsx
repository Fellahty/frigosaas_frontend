import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { PlatformTrendPoint, UsageHistoryPoint } from '../types';

function formatDateLabel(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export const PlatformTrendChart: React.FC<{ data: PlatformTrendPoint[] }> = ({ data }) => {
  const option = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 48, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: 'category',
        data: data.map((d) => formatDateLabel(d.date)),
        axisLabel: { fontSize: 10, color: '#64748b' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'Réceptions',
          type: 'line',
          smooth: true,
          data: data.map((d) => d.receptionsCount),
          itemStyle: { color: '#4f46e5' },
          areaStyle: { color: 'rgba(79,70,229,0.08)' },
        },
        {
          name: 'Réservations',
          type: 'line',
          smooth: true,
          data: data.map((d) => d.reservationsCount),
          itemStyle: { color: '#0ea5e9' },
        },
      ],
    }),
    [data]
  );

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Pas encore de données historiques.</p>;
  }

  return <ReactECharts option={option} style={{ height: 280 }} opts={{ renderer: 'svg' }} />;
};

export const OrganizationUsageChart: React.FC<{ data: UsageHistoryPoint[] }> = ({ data }) => {
  const option = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 48, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: 'category',
        data: data.map((d) => formatDateLabel(d.date)),
        axisLabel: { fontSize: 10, color: '#64748b' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'Réceptions',
          type: 'bar',
          data: data.map((d) => d.receptionsCount),
          itemStyle: { color: '#4f46e5', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Clients',
          type: 'line',
          smooth: true,
          data: data.map((d) => d.clientsCount),
          itemStyle: { color: '#10b981' },
        },
        {
          name: 'Chambres',
          type: 'line',
          smooth: true,
          data: data.map((d) => d.roomsCount),
          itemStyle: { color: '#f59e0b' },
        },
      ],
    }),
    [data]
  );

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Historique disponible après quelques jours d'usage.</p>;
  }

  return <ReactECharts option={option} style={{ height: 300 }} opts={{ renderer: 'svg' }} />;
};
