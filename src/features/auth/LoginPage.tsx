import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { authenticateUser, logout as logoutTenant, ApiError } from '../../lib/auth';
import { loginPlatformAdmin, clearPlatformAuth } from '../../lib/platformAuth';
import { useTenant } from '../../app/TenantProvider';
import { persistTenantSession } from '../../lib/tenantResolver';
import { LangSwitcher } from '../../components/LangSwitcher';

function isFrigoSmartAdminEmail(email: string): boolean {
  return email.toLowerCase().includes('@frigosmart.com');
}

type LoginFormData = {
  loginField: string;
  password: string;
};

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { legacyId, name, slug, loading: brandingLoading, error: brandingError, setFromLogin } = useTenant();
  const tenantId = legacyId;
  
  const loginSchema = z.object({
    loginField: z.string().min(1, t('auth.emailOrPhoneRequired') as string),
    password: z.string().min(1, t('auth.passwordRequired') as string),
  });
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginType, setLoginType] = useState<'email' | 'phone'>('email');
  const [userType, setUserType] = useState<'manager' | 'client'>('manager');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });


  const onSubmit = async (data: LoginFormData) => {
    setError('');
    try {
      // Compte FrigoSmart admin → panel /admin (pas le login frigo client)
      if (loginType === 'email' && isFrigoSmartAdminEmail(data.loginField)) {
        try {
          clearPlatformAuth();
          logoutTenant();
          await loginPlatformAdmin(data.loginField.trim(), data.password);
          navigate('/admin');
          return;
        } catch {
          setError('Compte FrigoSmart invalide. Vérifiez email et mot de passe.');
          return;
        }
      }

      if (!tenantId) {
        setError(brandingError || 'Client frigo introuvable. Vérifiez l\'URL de connexion.');
        return;
      }

      const user = await authenticateUser(data.loginField, data.password, tenantId, userType);

      if (user) {
        clearPlatformAuth();
        if (slug && name) setFromLogin(slug, user.tenantId, name);
        else persistTenantSession(slug || user.tenantId.toLowerCase(), user.tenantId, name || undefined);
        localStorage.setItem('tenantId', user.tenantId);
        localStorage.setItem('user', JSON.stringify({
          id: user.id,
          name: user.name,
          phone: user.phone,
          username: user.username,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          userType: userType,
        }));
        navigate('/dashboard');
        return;
      }

      // Secours : essai login admin plateforme si email
      if (loginType === 'email' && data.loginField.includes('@')) {
        try {
          clearPlatformAuth();
          logoutTenant();
          await loginPlatformAdmin(data.loginField.trim(), data.password);
          navigate('/admin');
          return;
        } catch {
          // ignore, show tenant error below
        }
      }

      setError(
        loginType === 'email' && isFrigoSmartAdminEmail(data.loginField)
          ? 'Compte FrigoSmart invalide. Utilisez le panel admin ou vérifiez le mot de passe.'
          : (t('auth.invalidCredentials', 'Identifiants invalides') as string)
      );
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(t('auth.invalidCredentials', 'Identifiants invalides') as string);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_50%)]"></div>
      </div>
      
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg relative z-10">
        {/* Language Switcher */}
        <div className="flex justify-end mb-2 sm:mb-3">
          <LangSwitcher />
        </div>
        
        {/* Logo Section */}
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light text-gray-900 tracking-tight leading-tight mb-4">
            {brandingLoading ? (
              <span className="inline-block h-10 w-48 bg-gray-200 rounded animate-pulse" />
            ) : (
              <span className="font-bold">{name || slug?.toUpperCase()}</span>
            )}
          </h1>

          {brandingError && (
            <p className="text-amber-600 text-sm mb-2">{brandingError}</p>
          )}
          
          {/* Minimalist welcome message */}
          <p className="text-gray-500 text-base sm:text-lg font-light max-w-md mx-auto leading-relaxed">
            {t('auth.welcome')}
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 lg:p-10 relative overflow-hidden">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent rounded-3xl"></div>
          <div className="relative z-10">
          <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-3 sm:p-4 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-2 sm:ml-3">
                    <p className="text-xs sm:text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* User Type Selector */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                {t('auth.userType')}
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setUserType('manager')}
                  className={`relative px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border-2 transition-all duration-200 ${
                    userType === 'manager'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="font-medium text-xs">{t('auth.manager')}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('client')}
                  className={`relative px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border-2 transition-all duration-200 ${
                    userType === 'client'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="font-medium text-xs">{t('auth.client')}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Login Type Selector */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                {t('auth.loginMethod')}
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setLoginType('email')}
                  className={`relative px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border-2 transition-all duration-200 ${
                    loginType === 'email'
                      ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium text-xs">{t('auth.email')}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setLoginType('phone')}
                  className={`relative px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border-2 transition-all duration-200 ${
                    loginType === 'phone'
                      ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="font-medium text-xs">{t('auth.phone')}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Login Field */}
            <div>
              <label htmlFor="loginField" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                {loginType === 'email' ? t('auth.emailAddress') : t('auth.phoneNumber')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {loginType === 'email' ? (
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  )}
                </div>
                <input
                  {...register('loginField')}
                  type={loginType === 'phone' ? 'tel' : 'email'}
                  id="loginField"
                  className="block w-full pl-9 pr-3 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm"
                  placeholder={loginType === 'email' ? (t('auth.emailPlaceholder') as string) : (t('auth.phonePlaceholder') as string)}
                />
              </div>
              {errors.loginField && (
                <p className="mt-2 text-sm text-red-600">{errors.loginField.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? "text" : "password"}
                  id="password"
                  className="block w-full pl-9 pr-10 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-gray-50/50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm"
                  placeholder={t('auth.passwordPlaceholder') as string}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || brandingLoading}
              className="w-full flex justify-center items-center py-3 sm:py-4 px-6 border border-transparent rounded-2xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {t('auth.connecting')}
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  {t('auth.signIn')}
                </>
              )}
            </button>
          </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-gray-500 font-light">
            {t('auth.copyright')}
          </p>
          <Link
            to="/admin/login"
            className="inline-block text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            Administration FrigoSmart →
          </Link>
        </div>
      </div>
    </div>
  );
};
