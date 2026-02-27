const TEMP_EXTENSION_PREFIX = 'tmp-ext-';

const readBoolEnv = (name, defaultValue = false) => {
  const raw = import.meta.env?.[name];
  if (raw === undefined) return defaultValue;
  return String(raw).toLowerCase() === 'true';
};

export const isExtensionsFeatureEnabled = () =>
  readBoolEnv('VITE_EXTENSIONS_ENABLED', true);

export const isExtensionsLocalFallbackEnabled = () =>
  readBoolEnv('VITE_EXTENSIONS_LOCAL_FALLBACK_ENABLED', true);

export const createTemporaryExtensionId = () => {
  const suffix =
    typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${TEMP_EXTENSION_PREFIX}${suffix}`;
};

export const isTemporaryExtensionId = extensionId =>
  typeof extensionId === 'string' && extensionId.startsWith(TEMP_EXTENSION_PREFIX);

export const isExtensionApiUnavailable = err => {
  const message = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  const status = Number(err?.status);

  if (code.includes('not_implemented') || code.includes('not implemented')) return true;
  if (status === 404 || status === 501) return true;

  return (
    message.includes('not_implemented') ||
    message.includes('not implemented') ||
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('bff backend is required')
  );
};
