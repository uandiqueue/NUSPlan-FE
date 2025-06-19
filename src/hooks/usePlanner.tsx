import { useContext } from 'react';
import { PayloadContext } from '../app/context/payloadContext';


export function usePlanner() {
  const ctx = useContext(PayloadContext);
  if (!ctx) throw new Error('usePlanner must be inside PayloadProvider');
  return ctx;
}