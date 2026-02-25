import React from 'react';
import { Search, Zap, RefreshCw } from 'lucide-react';
import { Button, Card, Input } from '@components/ui/UIKit';

export default function DashboardSidePanel({
  activeTab,
  canViewInbox,
  incomingApps,
  searchTerm,
  setSearchTerm,
  setActiveTab,
  assigneeFilter,
  setAssigneeFilter,
  taskFilter,
  setTaskFilter,
  counts,
  isBranchManager,
  isAdmin,
  isLoadingApps,
  onEmulateIncoming,
  onEmulateResubmission,
  registryFilter,
  setRegistryFilter,
}) {
  return (
    <Card className="w-[340px] max-w-[40vw] min-w-[300px] p-4 shadow-xl border-0 ring-1 ring-slate-200 rounded-2xl bg-white overflow-y-auto">
      <div className="space-y-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Поиск</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input
              placeholder="По номеру, названию, адресу..."
              className="pl-9 h-10 rounded-lg"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {(activeTab === 'workdesk' || activeTab === 'inbox') && (
          <>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Режим</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab('workdesk')}
                  className={`h-10 rounded-lg text-xs font-bold ${activeTab === 'workdesk' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Рабочий стол
                </button>
                {canViewInbox && (
                  <button
                    onClick={() => setActiveTab('inbox')}
                    className={`h-10 rounded-lg text-xs font-bold ${activeTab === 'inbox' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Входящие ({incomingApps.length})
                  </button>
                )}
              </div>
            </div>

            {activeTab === 'workdesk' && (
              <>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Исполнитель</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setAssigneeFilter('mine')}
                      className={`h-9 rounded-lg text-xs font-bold ${assigneeFilter === 'mine' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Мои
                    </button>
                    <button
                      onClick={() => setAssigneeFilter('all')}
                      className={`h-9 rounded-lg text-xs font-bold ${assigneeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Все
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Статусы</div>
                  <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => setTaskFilter('work')} className={`h-9 rounded-lg text-xs font-bold ${taskFilter === 'work' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>В работе ({counts.work})</button>
                    <button onClick={() => setTaskFilter('review')} className={`h-9 rounded-lg text-xs font-bold ${taskFilter === 'review' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>На проверке ({counts.review})</button>
                    <button onClick={() => setTaskFilter('integration')} className={`h-9 rounded-lg text-xs font-bold ${taskFilter === 'integration' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Интеграция ({counts.integration})</button>
                    {(isBranchManager || isAdmin) && (
                      <button onClick={() => setTaskFilter('pending_decline')} className={`h-9 rounded-lg text-xs font-bold ${taskFilter === 'pending_decline' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>На рассмотрении ({counts.pendingDecline})</button>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'inbox' && (
              <div className="space-y-2">
                <Button
                  onClick={onEmulateIncoming}
                  disabled={isLoadingApps}
                  className="w-full bg-indigo-600 text-white hover:bg-indigo-700 h-10 text-xs rounded-lg"
                >
                  <Zap size={14} className="mr-2" /> Эмуляция (API)
                </Button>
                <Button
                  onClick={onEmulateResubmission}
                  disabled={isLoadingApps}
                  className="w-full bg-emerald-700 text-white hover:bg-emerald-800 h-10 text-xs rounded-lg"
                >
                  <RefreshCw size={14} className="mr-2" /> Повторная подача
                </Button>
              </div>
            )}
          </>
        )}

        {activeTab === 'registry' && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Раздел реестра</div>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setRegistryFilter('applications')}
                className={`h-10 rounded-lg text-xs font-bold ${registryFilter === 'applications' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Заявления ({counts.registryApplications})
              </button>
              <button
                onClick={() => setRegistryFilter('complexes')}
                className={`h-10 rounded-lg text-xs font-bold ${registryFilter === 'complexes' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Жилые комплексы ({counts.registryComplexes})
              </button>
              <button
                onClick={() => setRegistryFilter('buildings')}
                className={`h-10 rounded-lg text-xs font-bold ${registryFilter === 'buildings' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Здания и сооружения
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
