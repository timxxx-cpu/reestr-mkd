import { createLazyStep } from '@/features/steps/shared/step-entry-factories';

export const CompositionStep = createLazyStep(() => import('./CompositionEditor'));
