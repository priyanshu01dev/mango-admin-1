import { PlanId } from '../types/admin';

// Brand-aligned, colour-blind-safe plan colours (validated with the dataviz palette checker)
export const PLAN_COLORS: Record<PlanId, string> = {
  free: '#3e9b2f', // leaf
  silver: '#1a5ba6', // First Wave blue
  gold: '#e25e0e', // mango
  platinum: '#7c5cd6' // violet
};

export const GST_ON_SUBSCRIPTION = 18;

export const SUPPORT_AGENTS = ['Unassigned', 'Support L1', 'Support L2', 'GST Expert'];
