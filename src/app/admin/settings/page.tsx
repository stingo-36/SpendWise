'use client';

import CredentialsForm from '@/components/CredentialsForm';

/** App-wide credentials (Google OAuth app, Anthropic key). Admins only — /api/config enforces it. */
export default function AdminSettingsPage() {
  return (
    <div className="space-y-5 pt-1">
      <header>
        <div className="eyebrow">Shared by all accounts</div>
        <h1 className="h-page mt-1.5">App settings</h1>
      </header>
      <CredentialsForm />
    </div>
  );
}
