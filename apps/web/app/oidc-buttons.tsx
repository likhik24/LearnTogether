'use client';

import { useEffect, useState } from 'react';
import type { OidcProviderInfo } from '@learn-and-build/types';
import { createAuthClient } from '../lib/api';

export function OidcButtons({
  returnTo,
  providerAccount = false,
}: {
  returnTo: string;
  providerAccount?: boolean;
}) {
  const [providers, setProviders] = useState<OidcProviderInfo[]>([]);

  useEffect(() => {
    let active = true;
    void createAuthClient()
      .oidcProviders()
      .then((items) => {
        if (active) setProviders(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!providers.length) return null;
  return (
    <div className="oidc-buttons" aria-label="Social sign in">
      {providers.map((provider) => {
        const url = new URL(provider.loginUrl);
        url.searchParams.set('returnTo', returnTo);
        if (providerAccount) url.searchParams.set('account', 'provider');
        return (
          <a key={provider.id} href={url.toString()}>
            Continue with {provider.label}
          </a>
        );
      })}
    </div>
  );
}
