'use client';

import CredentialsForm from '@/components/CredentialsForm';

/** App-wide credentials (Google OAuth app, Anthropic key). Admins only — /api/config enforces it. */
export default function AdminSettingsPage() {
  return (
    <div className="space-y-5 pt-1">
      <header>
        <h1 className="h-page">App settings</h1>
        <p className="text-sm text-muted">Shared by every SpendWise account. Users connect their own Gmail with these.</p>
      </header>
      <CredentialsForm />
    </div>
  );
}
