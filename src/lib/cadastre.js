const digitsOnly = (value = '') => String(value).replace(/\D/g, '');

const formatByGroups = (value, groups) => {
  const digits = digitsOnly(value);
  const maxLen = groups.reduce((sum, n) => sum + n, 0);
  const slice = digits.slice(0, maxLen);

  const parts = [];
  let offset = 0;
  for (const len of groups) {
    const part = slice.slice(offset, offset + len);
    if (!part) break;
    parts.push(part);
    offset += len;
  }
  return parts.join(':');
};

export const formatComplexCadastre = (value) => formatByGroups(value, [2, 2, 2, 2, 2, 4]);
export const formatBuildingCadastre = (value) => formatByGroups(value, [2, 2, 2, 2, 2, 5]);

const pad = (num, size) => String(num).padStart(size, '0');
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const createVirtualComplexCadastre = () => {
  return `10:09:03:02:01:${pad(randomInt(1, 9999), 4)}`;
};

export const createVirtualBuildingCadastre = () => {
  return `13:04:03:02:01:${pad(randomInt(1, 99999), 5)}`;
};

export const createVirtualApartmentCadastre = (buildingCadastre) => {
  const base = formatBuildingCadastre(buildingCadastre) || createVirtualBuildingCadastre();
  return `${base}:${pad(randomInt(1, 999), 3)}`;
};

export const createVirtualCommercialCadastre = (buildingCadastre) => {
  const base = formatBuildingCadastre(buildingCadastre) || createVirtualBuildingCadastre();
  return `${base}/${pad(randomInt(1, 9999), 4)}`;
};

export const createVirtualParkingCadastre = (buildingCadastre) => {
  const base = formatBuildingCadastre(buildingCadastre) || createVirtualBuildingCadastre();
  return `${base}/${pad(randomInt(1, 999), 3)}`;
};
