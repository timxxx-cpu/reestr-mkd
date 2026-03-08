import { createLazyStep } from '@/features/steps/shared/step-entry-factories';

export const ParkingConfigStep = createLazyStep(() =>
  import('./ParkingConfigurator').then(module => ({
    default: () => <module.default buildingId={null} />,
  }))
);
