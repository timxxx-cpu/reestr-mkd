/**
 * Общие утилиты форматирования и генерации кодов.
 * Используются в project-routes.js, integration-routes.js, project-extended-routes.js
 */

export function formatByGroups(value, groups) {
  const digits = String(value || '').replace(/\D/g, '');
  const maxLen = groups.reduce((sum, n) => sum + n, 0);
  const normalized = digits.slice(0, maxLen);

  const parts = [];
  let offset = 0;
  for (const len of groups) {
    const part = normalized.slice(offset, offset + len);
    if (!part) break;
    parts.push(part);
    offset += len;
  }

  return parts.join(':');
}

/** Кадастровый номер ЖК: 2:2:2:2:2:4 */
export function formatComplexCadastre(value) {
  return formatByGroups(value, [2, 2, 2, 2, 2, 4]);
}

/** Кадастровый номер здания: 2:2:2:2:2:5 */
export function formatBuildingCadastre(value) {
  return formatByGroups(value, [2, 2, 2, 2, 2, 5]);
}

/**
 * Находит следующий порядковый номер для генерации кодов.
 * @param {string[]} existingCodes - Существующие коды (сегменты)
 * @param {string} prefix - Префикс для фильтрации (например, 'UJ', 'EF')
 */
export function getNextSequenceNumber(existingCodes, prefix) {
  let max = 0;

  (existingCodes || []).forEach(code => {
    if (!code) return;
    const str = String(code);
    if (prefix && !str.startsWith(prefix)) return;
    const num = Number(prefix ? str.slice(prefix.length) : str.match(/\d+$/)?.[0] || 0);
    if (Number.isFinite(num) && num > max) max = num;
  });

  return max + 1;
}
