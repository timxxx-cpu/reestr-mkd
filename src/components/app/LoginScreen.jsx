import React, { useEffect, useState } from 'react';
import { Loader2, User, FolderOpen, KeyRound, Shield } from 'lucide-react';
import { ROLES } from '@lib/constants';

function LoginScreen({ onLogin, isLoading, users = [], usersLoading }) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const adminUsers = users.filter(u => u.role === ROLES.ADMIN);

  useEffect(() => {
    if (!selectedUserId && adminUsers.length > 0) {
      setSelectedUserId(adminUsers[0].id);
    }
  }, [adminUsers, selectedUserId]);

  const selectedUser = adminUsers.find(u => u.id === selectedUserId) || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white/95 backdrop-blur rounded-3xl shadow-2xl border border-white/50 overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="grid lg:grid-cols-2">
          <div className="bg-slate-900 text-white p-8 lg:p-10 flex flex-col justify-between">
            <div>
              <img
                src="/kadastr_logo.png"
                alt="Логотип Кадастрового агентства"
                className="h-20 w-auto mb-6 drop-shadow-lg"
              />
              <p className="text-xs uppercase tracking-[0.22em] text-blue-200/80 font-semibold">
                Агентство по кадастру Республики Узбекистан
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight">
                Интеграционная
                <br />
                Информационная система
              </h1>
              <p className="mt-4 text-sm text-slate-300 max-w-md">
                Реестр жилых комплексов и многоквартирных домов, ведение и сопровождение технической инвентаризации в едином рабочем пространстве.
              </p>
            </div>
            <div className="mt-8 text-xs text-slate-400">
              PREDEV-контур Концепт • Supabase / PostgreSQL
            </div>
          </div>

          <div className="p-8 lg:p-10 flex flex-col justify-center">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Вход в систему</h2>
              <p className="text-sm text-slate-500 mt-1">Выберите пользователя</p>
            </div>

            <div className="space-y-4 text-left">
              <label htmlFor="login-user-select" className="text-xs font-bold uppercase text-slate-500">Пользователь</label>
              <select
                id="login-user-select"
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                disabled={usersLoading || isLoading || adminUsers.length === 0}
                className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500"
              >
                {adminUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => selectedUser && onLogin(selectedUser)}
                disabled={isLoading || usersLoading || !selectedUser}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={20} />}
                {isLoading ? 'Вход в систему...' : 'Войти и открыть рабочий стол'}
              </button>

              <p className="text-xs text-slate-400 text-center">
                {usersLoading ? 'Загрузка пользователей...' : adminUsers.length === 0 ? 'Администраторы не найдены в справочнике' : 'уровень доступа PRE-DEV'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default LoginScreen;
