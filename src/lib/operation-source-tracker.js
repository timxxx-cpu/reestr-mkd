const OPERATION_SOURCE_KEY = '__reestrOperationSourceStats';
const OPERATION_SOURCE_API_KEY = '__reestrOperationSource';

const canUseWindow = () => typeof window !== 'undefined';

const ensureStore = () => {
  if (!canUseWindow()) return null;

  if (!window[OPERATION_SOURCE_KEY]) {
    window[OPERATION_SOURCE_KEY] = {
      bff: 0,
      legacy: 0,
      byOperation: {},
      updatedAt: null,
      initializedAt: new Date().toISOString(),
    };
  }

  return window[OPERATION_SOURCE_KEY];
};

const clone = value => JSON.parse(JSON.stringify(value));

const calcSummary = stats => {
  const total = Number(stats?.bff || 0) + Number(stats?.legacy || 0);
  const toPct = value => (total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0);

  return {
    total,
    bff: Number(stats?.bff || 0),
    legacy: Number(stats?.legacy || 0),
    bffSharePct: toPct(Number(stats?.bff || 0)),
    legacySharePct: toPct(Number(stats?.legacy || 0)),
    updatedAt: stats?.updatedAt || null,
    initializedAt: stats?.initializedAt || null,
  };
};

export const getOperationSourceStats = () => {
  const store = ensureStore();
  if (!store) return null;
  return clone(store);
};

export const getOperationSourceSummary = () => {
  const stats = getOperationSourceStats();
  if (!stats) return null;
  return calcSummary(stats);
};

export const resetOperationSourceStats = () => {
  const store = ensureStore();
  if (!store) return null;

  store.bff = 0;
  store.legacy = 0;
  store.byOperation = {};
  store.updatedAt = new Date().toISOString();

  return getOperationSourceStats();
};

const attachDevApi = () => {
  if (!import.meta.env.DEV || !canUseWindow()) return;

  if (window[OPERATION_SOURCE_API_KEY]) return;

  window[OPERATION_SOURCE_API_KEY] = {
    getStats: getOperationSourceStats,
    getSummary: getOperationSourceSummary,
    reset: resetOperationSourceStats,
  };

  console.info(
    '[DATA_PATH] Dev API attached: window.__reestrOperationSource.getSummary() / getStats() / reset()'
  );
};

export const trackOperationSource = ({ source, operation, requestId = null }) => {
  if (!import.meta.env.DEV) return;

  const normalizedSource = source === 'bff' ? 'bff' : 'legacy';
  const safeOperation = operation || 'unknown';
  const store = ensureStore();

  if (!store) return;

  attachDevApi();

  store[normalizedSource] += 1;
  store.byOperation[safeOperation] = {
    source: normalizedSource,
    requestId,
    count: (store.byOperation[safeOperation]?.count || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  store.updatedAt = new Date().toISOString();

  console.info('[DATA_PATH]', {
    source: normalizedSource,
    operation: safeOperation,
    requestId,
    totals: calcSummary(store),
  });
};
