import { Suspense } from 'react';
import { ThankYouContent } from './ThankYouContent';

export const dynamic = 'force-static';

export default function ThankYouPage() {
  return (
    <main className="min-h-screen bg-brand-cream">
      <Suspense fallback={<div className="p-10 text-center">Carregando...</div>}>
        <ThankYouContent />
      </Suspense>
    </main>
  );
}
