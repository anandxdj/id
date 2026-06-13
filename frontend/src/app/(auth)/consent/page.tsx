import { Suspense } from 'react';
import { ConsentCard } from '@/features/consent/components/ConsentCard';

export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <ConsentCard />
    </Suspense>
  );
}
