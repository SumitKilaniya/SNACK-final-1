import React, { Suspense } from 'react';
import AuthPage from '@/app/auth/page';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AuthPage />
    </Suspense>
  );
}
