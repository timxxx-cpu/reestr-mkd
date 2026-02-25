import { hasAnyRole } from './auth.js';

export const POLICY_MATRIX = Object.freeze({
  workflow: {
    mutate: ['admin', 'branch_manager', 'technician', 'controller'],
    assignTechnician: ['admin', 'branch_manager'],
    requestDecline: ['technician', 'admin', 'branch_manager'],
    decline: ['admin', 'branch_manager', 'controller'],
    returnFromDecline: ['admin', 'branch_manager'],
    restore: ['admin'],
  },
  projectInit: {
    createFromApplication: ['admin', 'branch_manager', 'technician'],
  },
  composition: {
    mutate: ['admin', 'branch_manager', 'technician'],
  },
  registry: {
    mutate: ['admin', 'branch_manager', 'technician'],
  },
  integration: {
    mutate: ['admin', 'branch_manager', 'technician'],
  },
  catalogs: {
    mutate: ['admin', 'branch_manager'],
  },
  projectExtended: {
    mutate: ['admin', 'branch_manager', 'technician'],
    deleteProject: ['admin', 'branch_manager'],
  },
  validation: {
    mutate: ['admin', 'branch_manager', 'technician', 'controller'],
  },
  versioning: {
    mutate: ['admin', 'branch_manager', 'technician', 'controller'],
    create: ['admin', 'branch_manager', 'technician'],
    approve: ['admin', 'branch_manager', 'controller'],
    decline: ['admin', 'branch_manager', 'controller'],
    restore: ['admin', 'branch_manager'],
  },
});

export const allowByPolicy = (actorRole, domain, action = 'mutate') => {
  const roles = POLICY_MATRIX?.[domain]?.[action] || [];
  return hasAnyRole(actorRole, roles);
};
