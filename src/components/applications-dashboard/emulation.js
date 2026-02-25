import { createVirtualComplexCadastre } from '@lib/cadastre';

export const buildIncomingEmulatedApplication = ({ externalSystemOptions = [] }) => {
  const randomId = Math.floor(1000 + Math.random() * 9000);
  const sources = externalSystemOptions.map(source => ({ id: source.code, label: source.label }));
  const randomSource = sources[Math.floor(Math.random() * sources.length)] || {
    id: 'UNKNOWN',
    label: 'Неизвестный источник',
  };

  return {
    app: {
      id: `APP-${Date.now()}`,
      externalId: `${randomSource.id}-${randomId}`,
      source: randomSource.id,
      applicant: `ООО "Строй-Инвест-${Math.floor(Math.random() * 100)}"`,
      submissionDate: new Date().toISOString(),
      cadastre: createVirtualComplexCadastre(),
      address: `г. Ташкент, Мирзо-Улугбекский р-н, кв-л ${Math.floor(Math.random() * 20)}`,
      status: 'NEW',
    },
    sourceLabel: randomSource.label,
  };
};

export const buildResubmissionEmulatedApplication = ({ candidate, source }) => {
  const cadastreNumber = candidate?.cadastre?.number || candidate?.complexInfo?.cadastreNumber;
  const randomId = Math.floor(1000 + Math.random() * 9000);

  return {
    id: `REAPP-${Date.now()}`,
    externalId: `${source}-RE-${randomId}`,
    source,
    applicant: candidate?.participants?.developer?.name || candidate?.name || 'Повторная подача',
    submissionDate: new Date().toISOString(),
    cadastre: cadastreNumber,
    address: candidate?.complexInfo?.street || candidate?.address || 'Адрес не указан',
    status: 'NEW',
    reapplicationForProjectId: candidate?.id,
    reapplicationForProjectName: candidate?.name,
  };
};
