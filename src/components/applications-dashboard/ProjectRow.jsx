import React from 'react';
import {
  MapPin,
  AlertCircle,
  Database,
  CheckCircle2,
  Clock,
  PlayCircle,
  Eye,
  Undo2,
  Ban,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { ROLES, WORKFLOW_SUBSTATUS, STEPS_CONFIG } from '@lib/constants';
import { Tooltip } from '@components/ui/UIKit';
import { IdentifierBadge } from '@components/ui/IdentifierBadge';
import VisualProgress from './VisualProgress';
import { formatDate, buildProjectRowState, getProjectRowClassName } from './utils';

import UserAvatar from './UserAvatar';

export default function ProjectRow({
  project,
  idx,
  user,
  onSelect,
  onDelete,
  onDecline,
  onReturnFromDecline,
  onReassign,
  viewOnly,
}) {
  const {
    app,
    info,
    substatus,
    statusConfig,
    substatusConfig,
    isDeclined,
    isCompleted,
    isPendingDeclineStatus,
    currentStepIdx,
    stepTitle,
    canEdit,
    canDecline,
    canReturnFromDecline,
    canReassign,
    canDelete,
  } = buildProjectRowState({ project, user });

  return (
    <tr
      key={project.id}
      className={getProjectRowClassName({
        isDeclined,
        isPendingDeclineStatus,
        isCompleted,
      })}
    >
      <td className="px-4 py-5 text-center text-slate-400 text-xs font-mono font-medium">{idx + 1}</td>

      <td className="px-4 py-5 align-top">
        <div className="flex justify-center">
          {project.ujCode ? (
            <IdentifierBadge code={project.ujCode} type="project" variant="default" />
          ) : (
            <span className="text-xs text-slate-300 font-mono">—</span>
          )}
        </div>
      </td>

      <td className="px-4 py-5 align-top">
        <div className="flex justify-center">
          {project.cadastre ? (
            <div className="flex items-center gap-1.5 bg-violet-50 px-2.5 py-1.5 rounded-lg border border-violet-100 group-hover:border-violet-200 transition-colors shadow-sm">
              <Database size={12} className="text-violet-400" />
              <span className="text-xs font-mono font-bold text-violet-700 whitespace-nowrap tracking-tight">
                {project.cadastre}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-300 font-mono">—</span>
          )}
        </div>
      </td>

      <td className="px-4 py-5 align-top">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              {app.internalNumber || '—'}
            </span>
            {app.externalSource && (
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border border-slate-100 px-1 rounded-md">
                {app.externalSource}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span className="w-3 inline-block text-center text-slate-300">Ext</span>
              <span className="text-slate-600 font-medium">{app.externalId || '—'}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <Clock size={10} className="text-slate-300" />
              <span>{formatDate(app.submissionDate)}</span>
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-5 align-top">
        <div className="flex flex-col gap-2">
          <div className="font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors" title={project.name}>
            {project.name}
          </div>

          <div className="flex items-start gap-1.5 text-xs text-slate-500">
            <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
            <span className="line-clamp-2 leading-relaxed" title={info.street}>
              {info.street || 'Адрес не указан'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {project.composition?.length || 0} зданий и сооружений
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-5 align-top">
        <div className="flex flex-col gap-3">
          <div className="bg-white/50 p-2 rounded-lg border border-slate-100 shadow-sm group-hover:border-blue-100 transition-colors">
            {isCompleted ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <CheckCircle2 size={14} />
                <span>Процесс завершен</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 line-clamp-1 mr-2" title={stepTitle}>
                    {stepTitle}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono font-bold bg-slate-100 px-1 rounded">
                    {currentStepIdx + 1}/{STEPS_CONFIG.length}
                  </span>
                </div>
                <VisualProgress current={currentStepIdx} total={STEPS_CONFIG.length} />
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pl-1">
            {app.assigneeName ? (
              <>
                <UserAvatar name={app.assigneeName} role={ROLES.TECHNICIAN} />
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">Исп.</span>
                  <span className="text-[10px] font-bold text-slate-700 leading-none">{app.assigneeName}</span>
                </div>
              </>
            ) : (
              <span className="text-slate-300 text-[10px] italic">Не назначен</span>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-5 align-top">
        <div className="flex flex-col items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border shadow-sm ${statusConfig.color}`}>
            {statusConfig.label}
            {isDeclined && <AlertCircle size={12} className="ml-1.5" />}
          </span>

          {substatus &&
            substatus !== WORKFLOW_SUBSTATUS.DRAFT &&
            substatus !== WORKFLOW_SUBSTATUS.DONE &&
            !isDeclined && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border bg-white/50 backdrop-blur-sm ${substatusConfig.color}`}>
                {substatusConfig.label}
              </span>
            )}

          {(isDeclined || app.rejectionReason || app.requestedDeclineReason) && (
            <div className="relative group/reason">
              <div className="cursor-help bg-red-50 text-red-600 p-1 rounded-full border border-red-100 hover:bg-red-100 transition-colors">
                <AlertCircle size={14} />
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg shadow-xl opacity-0 group-hover/reason:opacity-100 pointer-events-none transition-all z-50">
                <span className="font-bold block mb-1 text-red-300">
                  {isDeclined ? 'Причина отказа:' : 'Запрос на отказ:'}
                </span>
                {app.requestedDeclineReason || app.rejectionReason || '—'}
              </div>
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-5 text-right align-top">
        <div className="flex flex-col items-end gap-2">
          {!viewOnly && !isCompleted && canEdit ? (
            <Tooltip content="Взять в работу">
              <button
                onClick={() => onSelect(project.id, 'edit')}
                className="group/btn flex items-center gap-2 pl-3 pr-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-200 hover:shadow-lg transition-all active:scale-95"
              >
                <PlayCircle size={14} className="group-hover/btn:fill-white/20" /> Открыть
              </button>
            </Tooltip>
          ) : (
            <Tooltip content="Просмотр">
              <button
                onClick={() => onSelect(project.id, 'view')}
                className="flex items-center gap-2 pl-3 pr-4 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 text-xs font-bold rounded-lg transition-all shadow-sm"
              >
                <Eye size={14} /> Детали
              </button>
            </Tooltip>
          )}

          <div className="flex items-center justify-end gap-1 mt-1 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
            {!viewOnly && isPendingDeclineStatus && onReturnFromDecline && canReturnFromDecline && (
              <Tooltip content="Вернуть на доработку">
                <button
                  onClick={() => onReturnFromDecline(project.id, project.name)}
                  className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors"
                >
                  <Undo2 size={14} />
                </button>
              </Tooltip>
            )}

            {!viewOnly && canDecline && onDecline && (
              <Tooltip content="Отказать">
                <button
                  onClick={() => onDecline(project.id, project.name)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Ban size={14} />
                </button>
              </Tooltip>
            )}

            {!viewOnly && onReassign && canReassign && (
              <Tooltip content="Сменить исполнителя">
                <button
                  onClick={() => onReassign(project.id, project.name, app.assigneeName)}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                >
                  <UserCheck size={14} />
                </button>
              </Tooltip>
            )}

            {!viewOnly && onDelete && canDelete && (
              <Tooltip content="Удалить">
                <button
                  onClick={() => onDelete(project.id)}
                  className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
