import { createLazyStep } from '@/features/steps/shared/step-entry-factories';

export const IntegrationBuildingsStep = createLazyStep(() => import('./IntegrationBuildings'));
