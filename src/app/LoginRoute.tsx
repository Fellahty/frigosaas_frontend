import React from 'react';
import { useParams } from 'react-router-dom';
import { TenantProvider } from '../app/TenantProvider';
import { LoginPage } from '../features/auth/LoginPage';

export const LoginRoute: React.FC = () => {
  const { tenant } = useParams<{ tenant?: string }>();
  return (
    <TenantProvider pathSlug={tenant}>
      <LoginPage />
    </TenantProvider>
  );
};
