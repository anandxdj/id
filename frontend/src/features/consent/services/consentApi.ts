import { apiClient } from '@/lib/api-client';
import { API_PATHS } from '@/lib/constants';
import type { ApiEnvelope, ConsentContext } from '@/types';

export async function getConsentContext(transactionId: string): Promise<ConsentContext> {
  const res = await apiClient.get<ApiEnvelope<ConsentContext>>(
    `${API_PATHS.CONSENT_CONTEXT}?transaction_id=${encodeURIComponent(transactionId)}`,
  );
  return res.data;
}

export async function decideConsent(
  transactionId: string,
  decision: 'allow' | 'deny',
): Promise<{ redirect_url: string }> {
  const res = await apiClient.post<ApiEnvelope<{ redirect_url: string }>>(API_PATHS.CONSENT, {
    transaction_id: transactionId,
    decision,
  });
  return res.data;
}
