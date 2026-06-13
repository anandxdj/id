import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, ConsentContext } from '@/types';

export async function getConsentContext(transactionId: string): Promise<ConsentContext> {
  const res = await apiClient.get<ApiEnvelope<ConsentContext>>(
    `/api/oauth/consent/context?transaction_id=${encodeURIComponent(transactionId)}`,
  );
  return res.data;
}

export async function decideConsent(
  transactionId: string,
  decision: 'allow' | 'deny',
): Promise<{ redirect_url: string }> {
  const res = await apiClient.post<ApiEnvelope<{ redirect_url: string }>>('/api/oauth/consent', {
    transaction_id: transactionId,
    decision,
  });
  return res.data;
}
