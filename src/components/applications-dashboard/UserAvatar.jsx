import React from 'react';
import { ROLES } from '@lib/constants';

export default function UserAvatar({ name, role }) {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  const bgColors = {
    [ROLES.ADMIN]: 'bg-purple-600 text-white',
    [ROLES.CONTROLLER]: 'bg-orange-500 text-white',
    [ROLES.TECHNICIAN]: 'bg-blue-600 text-white',
  };

  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${bgColors[role] || 'bg-slate-500'}`}
      title={name}
    >
      {initials}
    </div>
  );
}
