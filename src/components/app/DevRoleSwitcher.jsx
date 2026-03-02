import React, { useContext, useState } from 'react';
import { Users, X, Settings } from 'lucide-react';
import { ROLES } from '@lib/constants';
import { PersonaContext } from '@context/PersonaContext';

export const DevRoleSwitcher = ({ disabled }) => {
  const { activePersona, setActivePersona, availablePersonas } = useContext(PersonaContext);
  const [isOpen, setIsOpen] = useState(false);

  const roleVariants = (availablePersonas || []).filter(
    u => u.group === activePersona.group || u.name === activePersona.name
  );

  if (!activePersona) return null;

  return (
    // Заменили top-20 на bottom-6
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {!disabled && (
        <div
          className={`
                    bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 mb-4 w-72 pointer-events-auto
                    transition-all duration-300 origin-bottom-right
                    ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-10 invisible'}
                `}
        >
          <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-700">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Settings size={14} /> Роль пользователя
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            <div className="text-[10px] font-bold text-slate-500 mb-1.5 ml-1">
              {activePersona.group || activePersona.name}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {roleVariants.map(user => {
                const isActive = activePersona.id === user.id;
                let roleLabel = 'Тех';
                let roleColor = 'text-blue-400 bg-blue-400/10 border-blue-400/20';

                if (user.role === ROLES.ADMIN) {
                  roleLabel = 'Адм';
                  roleColor = 'text-purple-400 bg-purple-400/10 border-purple-400/20';
                } else if (user.role === ROLES.CONTROLLER) {
                  roleLabel = 'Бриг';
                  roleColor = 'text-orange-400 bg-orange-400/10 border-orange-400/20';
                } else if (user.role === ROLES.BRANCH_MANAGER) {
                  roleLabel = 'Нач';
                  roleColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
                }

                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      setActivePersona(user);
                      setIsOpen(false);
                    }}
                    className={`
                                                    px-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all
                                                    ${
                                                      isActive
                                                        ? 'bg-slate-100 border-slate-100 text-slate-900 shadow-sm'
                                                        : `${roleColor} hover:bg-slate-800`
                                                    }
                                                `}
                  >
                    {roleLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
                    w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all pointer-events-auto
                    ${
                      disabled
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50 grayscale'
                        : isOpen
                          ? 'bg-slate-700 text-white rotate-90'
                          : 'bg-slate-900 text-blue-400 hover:bg-blue-600 hover:text-white hover:scale-110'
                    }
                `}
        title={disabled ? 'Смена роли недоступна внутри задачи' : 'Сменить роль'}
      >
        <Users size={20} />
      </button>
    </div>
  );
};