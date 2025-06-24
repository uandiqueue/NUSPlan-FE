import { useContext } from 'react';
import { PlannerContext } from '../context/payloadContext';

export function usePlanner() {
    const ctx = useContext(PlannerContext);
    if (!ctx) throw new Error('usePlanner must be inside PlannerProvider');
    return ctx;
}