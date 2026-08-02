import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TabNav } from '../../components/TabNav';
import { SaveBar } from '../../components/SaveBar';
import { GeneralTab } from './tabs/GeneralTab';
import { RoomsTab } from './tabs/RoomsTab';
import { PoolTab } from './tabs/PoolTab';
import { PricingTab } from './tabs/PricingTab';
import { SeasonsTab } from './tabs/SeasonsTab';
import { PrintingTab } from './tabs/PrintingTab';

const TABS = [
  {
    id: 'general',
    label: 'Général',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'seasons',
    label: 'Saisons',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'rooms',
    label: 'Chambres & capteurs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: 'pool',
    label: 'Caisses vides',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 'pricing',
    label: 'Tarifs & paiements',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
  },
  {
    id: 'printing',
    label: 'Impression',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
    ),
  },
];

export const SettingsLayout: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [isDirty, setIsDirty] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const generalTabRef = useRef<{ save: () => Promise<void> }>(null);
  const poolTabRef = useRef<{ save: () => Promise<void> }>(null);
  const pricingTabRef = useRef<{ save: () => Promise<void> }>(null);
  const printingTabRef = useRef<{ save: () => Promise<void> }>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      switch (activeTab) {
        case 'general':
          if (generalTabRef.current?.save) await generalTabRef.current.save();
          break;
        case 'pool':
          if (poolTabRef.current?.save) await poolTabRef.current.save();
          break;
        case 'pricing':
          if (pricingTabRef.current?.save) await pricingTabRef.current.save();
          break;
        case 'printing':
          if (printingTabRef.current?.save) await printingTabRef.current.save();
          break;
        default:
          break;
      }
      setIsDirty(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsDirty(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralTab ref={generalTabRef} onDirtyChange={setIsDirty} onValidChange={setIsValid} />
        );
      case 'seasons':
        return <SeasonsTab />;
      case 'rooms':
        return <RoomsTab onDirtyChange={setIsDirty} onValidChange={setIsValid} />;
      case 'pool':
        return <PoolTab ref={poolTabRef} onDirtyChange={setIsDirty} onValidChange={setIsValid} />;
      case 'pricing':
        return (
          <PricingTab ref={pricingTabRef} onDirtyChange={setIsDirty} onValidChange={setIsValid} />
        );
      case 'printing':
        return (
          <PrintingTab ref={printingTabRef} onDirtyChange={setIsDirty} onValidChange={setIsValid} />
        );
      default:
        return <div className="text-center py-8 text-gray-500">Sélectionnez un onglet</div>;
    }
  };

  const showSaveBar = activeTab !== 'seasons' && activeTab !== 'rooms';

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('sidebar.frigoSettings', 'Paramètres (Frigo)')}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('settings.subtitle', 'Configurez les paramètres de votre installation frigorifique')}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <TabNav
          tabs={TABS.map((tab) => ({
            ...tab,
            label: t(`settings.tabs.${tab.id}`, tab.label),
          }))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="p-8">{renderTabContent()}</div>
      </div>

      {showSaveBar && (
        <SaveBar
          onSave={handleSave}
          onCancel={handleCancel}
          isDirty={isDirty}
          isValid={isValid}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};
