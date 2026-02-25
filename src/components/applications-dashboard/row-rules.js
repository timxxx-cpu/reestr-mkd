export const getProjectRowClassName = ({ isDeclined, isPendingDeclineStatus, isCompleted }) =>
  `
  group transition-all duration-200 border-l-[3px]
  ${isDeclined
    ? 'border-l-red-500 bg-red-50/30 hover:bg-red-50'
    : isPendingDeclineStatus
      ? 'border-l-amber-500 bg-amber-50/30 hover:bg-amber-50'
      : isCompleted
        ? 'border-l-emerald-500 hover:bg-emerald-50/20'
        : 'border-l-transparent hover:border-l-blue-500 hover:bg-blue-50/40 hover:shadow-md hover:translate-x-0.5'}
`;
