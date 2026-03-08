import { createLazyStep } from '@/features/steps/shared/step-entry-factories';

export const PassportStep = createLazyStep(() => import('./PassportEditor'));
