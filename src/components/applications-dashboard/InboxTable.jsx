import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@components/ui/UIKit';
import { formatDate } from './utils';
import EmptyState from './EmptyState';

export default function InboxTable({ data, onTake, canTake }) {
  if (data.length === 0) {
    return <EmptyState label="Нет входящих заявок" subLabel="Ожидайте поступления из внешних систем" />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-left text-sm border-collapse relative">
        <thead className="bg-slate-50/95 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md shadow-sm">
          <tr>
            <th className="px-6 py-4">Источник</th>
            <th className="px-6 py-4">Внешний ID</th>
            <th className="px-6 py-4">Дата подачи</th>
            <th className="px-6 py-4">Заявитель</th>
            <th className="px-6 py-4">Кадастровый номер ЖК</th>
            <th className="px-6 py-4 w-1/3">Адрес участка</th>
            <th className="px-6 py-4">Статус</th>
            <th className="px-6 py-4 text-right">Действие</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map(app => (
            <tr key={app.id} className="hover:bg-blue-50/30 transition-colors">
              <td className="px-6 py-4">
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded border border-slate-200">{app.source}</span>
              </td>
              <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700">{app.externalId}</td>
              <td className="px-6 py-4 text-xs text-slate-500">{formatDate(app.submissionDate)}</td>
              <td className="px-6 py-4 font-bold text-slate-800">{app.applicant}</td>
              <td className="px-6 py-4">
                <div className="font-mono text-xs text-slate-700">{app.cadastre || '—'}</div>
                {app.reapplicationForProjectName ? (
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                    Повторно по ЖК: {app.reapplicationForProjectName}
                  </div>
                ) : null}
              </td>
              <td className="px-6 py-4 text-xs text-slate-600">{app.address}</td>
              <td className="px-6 py-4">
                {app.status === 'DECLINED' ? (
                  <div
                    className="inline-flex items-center px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-[10px] font-bold"
                    title={app.declineReason || 'Отказ в принятии'}
                  >
                    Отказано
                  </div>
                ) : (
                  <div className="inline-flex items-center px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold">
                    Новая
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <Button
                  onClick={() => canTake && app.status !== 'DECLINED' && onTake(app)}
                  disabled={!canTake || app.status === 'DECLINED'}
                  className={`h-9 text-xs px-4 shadow-sm rounded-lg ${
                    !canTake || app.status === 'DECLINED'
                      ? 'bg-slate-300 opacity-50 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Принять <ArrowRight size={12} className="ml-1" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
