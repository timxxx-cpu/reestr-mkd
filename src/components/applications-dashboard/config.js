import { Trash2, AlertTriangle, UserCheck, MessageSquare } from 'lucide-react';

export const DASHBOARD_DEFAULTS = {
  TAB: 'workdesk',
  TASK_FILTER: 'work',
  REGISTRY_FILTER: 'applications',
  ASSIGNEE_FILTER: 'all',
};

export const ACTION_MODAL_INTENT_STYLES = {
  destructive: {
    icon: Trash2,
    headerBg: 'bg-red-50 border-red-100',
    iconColor: 'text-red-600 bg-white border-red-100',
    buttonClass: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertTriangle,
    headerBg: 'bg-amber-50 border-amber-100',
    iconColor: 'text-amber-600 bg-white border-amber-100',
    buttonClass: 'bg-amber-600 hover:bg-amber-700',
  },
  info: {
    icon: UserCheck,
    headerBg: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-600 bg-white border-blue-100',
    buttonClass: 'bg-blue-600 hover:bg-blue-700',
  },
  default: {
    icon: MessageSquare,
    headerBg: 'bg-slate-50 border-slate-100',
    iconColor: 'text-slate-600 bg-white',
    buttonClass: 'bg-slate-900 hover:bg-slate-800',
  },
};
