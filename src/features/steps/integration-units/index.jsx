import { createLazyStep } from '@/features/steps/shared/step-entry-factories';

export const IntegrationUnitsStep = createLazyStep(() => import('./IntegrationUnits'));
