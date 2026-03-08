import React from 'react';
import { getRoleKey } from '@lib/roles';

export default function UserAvatar({ name, role }) {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  const roleKey = getRoleKey(role);
  const bgColors = {
    admin: 'bg-purple-600 text-white',
    controller: 'bg-orange-500 text-white',
    technician: 'bg-blue-600 text-white',
  };

  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${bgColors[roleKey] || 'bg-slate-500'}`}
      title={name}
    >
      {initials}
    </div>
  );
}
