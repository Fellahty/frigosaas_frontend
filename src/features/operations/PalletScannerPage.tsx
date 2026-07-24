import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, doc, getDoc } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Spinner } from '../../components/Spinner';
import QrScanner from 'qr-scanner';

interface PalletInfo {
  id: string;
  receptionId: string;
  clientId: string;
  clientName: string;
  tenantId?: string;
  totalCrates: number;
  cratesPerPallet: number;
  customPalletCrates: Record<number, number>;
  pallets: Array<{
    number: number;
    crates: number;
    isFull: boolean;
    reference: string;
    palletNumber?: string;
  }>;
  createdAt: any;
  updatedAt: any;
  // Additional fields for reception data
  productName?: string;
  productVariety?: string;
  roomName?: string;
  arrivalTime?: any;
  source?: string;
}

interface ReceptionInfo {
  id: string;
  clientName: string;
  productName: string;
  productVariety: string;
  roomName: string;
  arrivalTime: any;
  crateCount: number;
  totalCrates?: number;
  tenantId?: string;
  clientId?: string;
  palletsCount?: number;
  palletReferences?: string[];
  source?: string;
}

const PalletScannerPage: React.FC = () => {
  const { t } = useTranslation();
  const hookTenantId = useTenantId();
  const tenantId = hookTenantId || 'YAZAMI'; // Fallback to hardcoded value
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [palletInfo, setPalletInfo] = useState<PalletInfo | null>(null);
  const [receptionInfo, setReceptionInfo] = useState<ReceptionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  // Check if camera is supported
  const checkCameraSupport = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(t('palletScanner.errors.cameraNotSupported', 'Votre navigateur ne supporte pas l\'accès à la caméra. Veuillez utiliser un navigateur moderne.') as string);
        return false;
      }
    return true;
  };

  // Start camera for QR code scanning
  const startCamera = async () => {
    try {
      setIsScanning(true);
      setError('');
      
      if (!checkCameraSupport()) {
        setIsScanning(false);
        return;
      }
      
      // Wait for the video element to be rendered
      let attempts = 0;
      const maxAttempts = 20; // Increased for mobile
      
      while (!videoRef.current && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        console.log(`Waiting for video element... attempt ${attempts}/${maxAttempts}`);
      }
      
      if (!videoRef.current) {
        setError(t('palletScanner.errors.videoNotFound', 'Élément vidéo non trouvé. Veuillez réessayer.') as string);
        setIsScanning(false);
        return;
      }

      console.log('Video element found, initializing QR Scanner...');
      
      // Additional check to ensure video element is properly mounted
      if (!videoRef.current.parentNode) {
        setError(t('palletScanner.errors.videoNotMounted', 'Élément vidéo non correctement monté. Veuillez réessayer.') as string);
        setIsScanning(false);
        return;
      }

      // Ensure video element is visible and has dimensions
      const videoElement = videoRef.current;
      if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
        console.log('Video element has no dimensions, waiting...');
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('Video element dimensions:', {
        width: videoElement.offsetWidth,
        height: videoElement.offsetHeight
      });

      // Initialize QR Scanner with mobile-optimized settings
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          console.log('🎯 QR Code detected successfully!');
          console.log('📱 Raw QR data:', result.data);
          console.log('📱 QR data type:', typeof result.data);
          console.log('📱 QR data length:', result.data?.length);
          
          vibrateOnScan(); // Vibration feedback on mobile
          setScannedCode(result.data);
          setScanSuccess(true);
          // Automatically stop camera and search for pallet
          stopCamera();
          searchPallet(result.data);
          
          // Hide success message after 3 seconds
          setTimeout(() => setScanSuccess(false), 3000);
        },
        {
          onDecodeError: (error) => {
            // Silently handle decode errors - no visual feedback needed
            console.log('⚠️ QR decode error:', error);
          },
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment', // Use back camera on mobile
          maxScansPerSecond: 10, // Increase scanning frequency for better detection
          calculateScanRegion: (video) => {
            // Use full video area for scanning
            return {
              x: 0,
              y: 0,
              width: video.videoWidth,
              height: video.videoHeight
            };
          }
        }
      );

      await qrScannerRef.current.start();
      console.log('QR Scanner started successfully');

    } catch (err) {
      console.error('Error accessing camera:', err);
      let errorMessage = t('palletScanner.errors.cameraError', 'Impossible d\'accéder à la caméra. ');
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage += t('palletScanner.errors.cameraAccessDenied', 'Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur.');
        } else if (err.name === 'NotFoundError') {
          errorMessage += t('palletScanner.errors.cameraNotFound', 'Aucune caméra trouvée sur cet appareil.');
        } else if (err.name === 'NotSupportedError') {
          errorMessage += t('palletScanner.errors.cameraNotSupported', 'Votre navigateur ne supporte pas l\'accès à la caméra.');
        } else {
          errorMessage += `Erreur: ${err.message}`;
        }
      } else {
        errorMessage += t('common.retry', 'Veuillez réessayer.');
      }
      
      setError(errorMessage);
      setIsScanning(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    try {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
    } catch (err) {
      console.log('QR Scanner was not running');
    }
    setIsScanning(false);
  };

  // Manual code input
  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScannedCode(e.target.value);
  };

  // Search for pallet by reference or QR code data
  const searchPallet = async (qrData: string) => {
    if (!qrData.trim()) return;

    if (!tenantId) {
      setError('Erreur: ID du tenant non disponible. Veuillez rafraîchir la page.');
      return;
    }

    setLoading(true);
    setError('');
    setPalletInfo(null);
    setReceptionInfo(null);

    try {
      console.log('🔍 Searching for pallet with QR data:', qrData);
      console.log('🏢 Tenant ID:', tenantId);
      console.log('📝 QR data type:', typeof qrData);
      console.log('📏 QR data length:', qrData?.length);
      
      let reference = qrData?.toString().trim();
      
      if (!reference) {
        console.error('❌ Empty QR code data');
        setError(t('palletScanner.errors.emptyQRCode', 'QR code vide détecté') as string);
        return;
      }
      
      // Try to parse QR code data as JSON (if it contains pallet info)
      try {
        const qrCodeData = JSON.parse(qrData);
        console.log('📋 Parsed QR code as JSON:', qrCodeData);
        
        if (qrCodeData.palletReference) {
          reference = qrCodeData.palletReference;
          console.log('✅ Extracted reference from palletReference:', reference);
        } else if (qrCodeData.reference) {
          reference = qrCodeData.reference;
          console.log('✅ Extracted reference from reference:', reference);
        } else if (qrCodeData.palletNumber) {
          reference = qrCodeData.palletNumber.toString();
          console.log('✅ Extracted reference from palletNumber:', reference);
        } else if (qrCodeData.number) {
          reference = qrCodeData.number.toString();
          console.log('✅ Extracted reference from number:', reference);
        }
      } catch (parseError) {
        // If not JSON, use the raw data as reference
        console.log('📝 QR code data is not JSON, using as reference:', reference);
      }
      
      console.log('🎯 Final reference to search for:', reference);
      
      // Search in pallet-collections collection
      const palletQuery = query(
        collection(db, 'pallet-collections'),
        where('tenantId', '==', tenantId)
      );
      
      const palletSnapshot = await getDocs(palletQuery);
      console.log('Found', palletSnapshot.docs.length, 'pallet collections');
      
      // Debug: Log all available pallet collections
      palletSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Collection ${index + 1}:`, {
          id: doc.id,
          tenantId: data.tenantId,
          receptionId: data.receptionId,
          clientName: data.clientName,
          totalCrates: data.totalCrates,
          palletsCount: data.pallets?.length || 0,
          palletReferences: data.pallets?.map((p: any) => p.reference) || []
        });
      });
      
      let foundPallet: PalletInfo | null = null;

      // Look for pallet with matching reference
      for (const docSnapshot of palletSnapshot.docs) {
        const data = docSnapshot.data() as PalletInfo;
        console.log('Checking collection:', docSnapshot.id, 'pallets:', data.pallets?.length);
        
        if (data.pallets && Array.isArray(data.pallets)) {
          // Search by reference first, then by pallet number
          const matchingPallet = data.pallets.find((p: any) => 
            p.reference === reference || 
            p.number === reference || 
            p.palletNumber === reference
          );
          if (matchingPallet) {
            console.log('Found matching pallet:', matchingPallet);
            foundPallet = { ...data, id: docSnapshot.id };
            break;
          }
        }
      }

      // If not found in pallet-collections, search in receptions
      if (!foundPallet) {
        console.log('Not found in pallet-collections, searching in receptions...');
        
        const receptionsQuery = query(
          collection(db, 'receptions'),
          where('tenantId', '==', tenantId)
        );
        
        const receptionsSnapshot = await getDocs(receptionsQuery);
        console.log('Found', receptionsSnapshot.docs.length, 'receptions');
        
        for (const docSnapshot of receptionsSnapshot.docs) {
          const data = docSnapshot.data();
          console.log('Checking reception:', docSnapshot.id, 'pallets:', data.pallets?.length);
          
          if (data.pallets && Array.isArray(data.pallets)) {
            // Search by reference first, then by pallet number
            const matchingPallet = data.pallets.find((p: any) => 
              p.reference === reference || 
              p.number === reference || 
              p.palletNumber === reference
            );
            if (matchingPallet) {
              console.log('Found matching pallet in reception:', matchingPallet);
              foundPallet = {
                id: docSnapshot.id,
                receptionId: docSnapshot.id,
                clientId: data.clientId || '',
                clientName: data.clientName || '',
                tenantId: data.tenantId || tenantId,
                totalCrates: data.totalCrates || 0,
                cratesPerPallet: data.cratesPerPallet || 0,
                customPalletCrates: data.customPalletCrates || {},
                pallets: data.pallets || [],
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
                productName: data.productName || '',
                productVariety: data.productVariety || '',
                roomName: data.roomName || '',
                arrivalTime: data.arrivalTime || null,
                source: data.source || ''
              };
              break;
            }
          }
        }
      }

      // If still not found, search in tenant-specific receptions subcollection
      if (!foundPallet) {
        console.log('Not found in main receptions, searching in tenant receptions...');
        
        const tenantReceptionsQuery = query(
          collection(db, 'tenants', tenantId, 'receptions')
        );
        
        const tenantReceptionsSnapshot = await getDocs(tenantReceptionsQuery);
        console.log('Found', tenantReceptionsSnapshot.docs.length, 'tenant receptions');
        
        for (const docSnapshot of tenantReceptionsSnapshot.docs) {
          const data = docSnapshot.data();
          console.log('Checking tenant reception:', docSnapshot.id, 'pallets:', data.pallets?.length);
          
          if (data.pallets && Array.isArray(data.pallets)) {
            // Search by reference first, then by pallet number
            const matchingPallet = data.pallets.find((p: any) => 
              p.reference === reference || 
              p.number === reference || 
              p.palletNumber === reference
            );
            if (matchingPallet) {
              console.log('Found matching pallet in tenant reception:', matchingPallet);
              foundPallet = {
                id: docSnapshot.id,
                receptionId: docSnapshot.id,
                clientId: data.clientId || '',
                clientName: data.clientName || '',
                tenantId: data.tenantId || tenantId,
                totalCrates: data.totalCrates || 0,
                cratesPerPallet: data.cratesPerPallet || 0,
                customPalletCrates: data.customPalletCrates || {},
                pallets: data.pallets || [],
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
                productName: data.productName || '',
                productVariety: data.productVariety || '',
                roomName: data.roomName || '',
                arrivalTime: data.arrivalTime || null,
                source: data.source || ''
              };
              break;
            }
          }
        }
      }

      if (foundPallet) {
        setPalletInfo(foundPallet);
        
        // Get reception information
        try {
          // If we found the pallet in a reception, we already have the reception data
          if (foundPallet.id === foundPallet.receptionId) {
            // This means we found it directly in receptions collection
            const receptionData = {
              id: foundPallet.id,
              tenantId: foundPallet.tenantId,
              clientId: foundPallet.clientId,
              clientName: foundPallet.clientName || '',
              productName: foundPallet.productName || '',
              productVariety: foundPallet.productVariety || '',
              roomName: foundPallet.roomName || '',
              arrivalTime: foundPallet.arrivalTime || null,
              source: foundPallet.source || '',
              crateCount: foundPallet.totalCrates,
              totalCrates: foundPallet.totalCrates,
              palletsCount: foundPallet.pallets?.length || 0,
              palletReferences: foundPallet.pallets?.map((p: any) => p.reference) || []
            };
            setReceptionInfo(receptionData);
            console.log('Using reception data from pallet info:', receptionData);
          } else {
            // We found it in pallet-collections, need to fetch reception data
            console.log('Searching for reception data for ID:', foundPallet.receptionId);
            // Try tenant-specific receptions first
            let receptionDoc = await getDoc(doc(db, 'tenants', tenantId, 'receptions', foundPallet.receptionId));
            let receptionData = null;
            
            if (receptionDoc.exists()) {
              receptionData = receptionDoc.data() as ReceptionInfo;
              console.log('Found reception info in tenant receptions:', receptionData);
            } else {
              // Try main receptions collection
              console.log('Not found in tenant receptions, trying main receptions collection...');
              receptionDoc = await getDoc(doc(db, 'receptions', foundPallet.receptionId));
              
              if (receptionDoc.exists()) {
                receptionData = receptionDoc.data() as ReceptionInfo;
                console.log('Found reception info in main receptions:', receptionData);
              } else {
                // Try searching in all receptions by tenantId
                console.log('Not found in main receptions, searching by tenantId...');
                const receptionsQuery = query(
                  collection(db, 'receptions'),
                  where('tenantId', '==', tenantId)
                );
                const receptionsSnapshot = await getDocs(receptionsQuery);
                
                const matchingReception = receptionsSnapshot.docs.find(doc => doc.id === foundPallet.receptionId);
                if (matchingReception) {
                  receptionData = matchingReception.data() as ReceptionInfo;
                  receptionDoc = matchingReception;
                  console.log('Found reception info in tenant-filtered receptions:', receptionData);
                } else {
                  console.log('Reception not found in any collection for ID:', foundPallet.receptionId);
                  setError(t('palletScanner.errors.receptionNotFound', 'Informations de réception non trouvées pour cette palette.') as string);
                  return;
                }
              }
            }
            
            if (receptionData) {
              setReceptionInfo({ ...receptionData, id: receptionDoc.id });
            }
          }
        } catch (receptionErr) {
          console.error('Error fetching reception:', receptionErr);
          setError(t('palletScanner.errors.receptionNotFound', 'Erreur lors de la récupération des informations de réception.') as string);
        }
      } else {
        console.log('No pallet found with reference:', reference);
        setError(t('palletScanner.errors.palletNotFound', 'Palette non trouvée. Vérifiez le QR code et réessayez.') as string);
      }
    } catch (err) {
      console.error('Error searching for pallet:', err);
      if (err instanceof Error) {
        setError(t('palletScanner.errors.searchError', `Erreur lors de la recherche de la palette: ${err.message}`) as string);
      } else {
        setError(t('palletScanner.errors.searchError', 'Erreur lors de la recherche de la palette.') as string);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchPallet(scannedCode);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Ensure video element is ready when scanning starts
  useEffect(() => {
    if (isScanning && videoRef.current) {
      console.log('Video element is ready for scanning');
    }
  }, [isScanning]);

  // Add vibration feedback on successful scan (mobile)
  const vibrateOnScan = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(200); // Short vibration
    }
  };

  // Debug logging
  console.log('PalletScannerPage render - tenantId:', tenantId);

  // Show loading if tenantId is not available
  if (!tenantId) {
    console.log('TenantId not available, showing loading...');
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-600">Chargement des données...</p>
            <p className="mt-2 text-sm text-gray-500">En attente de l'ID du tenant...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* Apple-style Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
            {t('palletScanner.title', 'Scanner de Palettes')}
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-md mx-auto leading-relaxed">
            {t('palletScanner.subtitle', 'Scannez le QR code d\'une palette pour voir ses informations')}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Scanner Section - Apple Style */}
        <div className="bg-white rounded-3xl shadow-xl shadow-blue-500/10 border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('palletScanner.scanner', 'Scanner')}</h2>
            </div>
          
          {!isScanning ? (
            <div className="text-center py-8 md:py-12">
              <div className="w-24 h-24 md:w-28 md:h-28 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center shadow-lg">
                <svg className="w-12 h-12 md:w-14 md:h-14 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {t('palletScanner.title', 'Scanner de Palettes')}
              </h3>
              <p className="text-base text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">
                {t('palletScanner.clickToStart', 'Appuyez sur le bouton ci-dessous pour démarrer le scanner')}
              </p>
              <button
                onClick={startCamera}
                className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-lg rounded-2xl shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <svg className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
{t('palletScanner.startScanner', 'Démarrer le scanner')}
              </button>
              <div className="mt-8 space-y-3">
                <div className="flex items-center p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200">
                  <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center mr-3">
                    <span className="text-amber-600 text-sm">💡</span>
                  </div>
                  <p className="text-sm text-amber-800 font-medium">
                    {t('palletScanner.tips.tip1', 'Autorisez l\'accès à la caméra quand votre navigateur le demande')}
                  </p>
                </div>
                <div className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
                    <span className="text-blue-600 text-sm">📱</span>
                  </div>
                  <p className="text-sm text-blue-800 font-medium">
                    {t('palletScanner.tips.tip5', 'Utilisez la caméra arrière pour un meilleur scan')}
                  </p>
                </div>
                <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200">
                  <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center mr-3">
                    <span className="text-green-600 text-sm">✅</span>
                  </div>
                  <p className="text-sm text-green-800 font-medium">
                    {t('palletScanner.tips.tip5', 'Compatible avec tous les téléphones modernes')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-2xl shadow-2xl">
                <video
                  ref={videoRef}
                  className="w-full h-80 sm:h-96 md:h-[28rem] bg-gray-900 object-cover"
                  style={{ position: 'relative' }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 border-2 border-white/80 rounded-2xl bg-transparent shadow-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 sm:w-10 sm:h-10 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 sm:w-10 sm:h-10 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-10 sm:h-10 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-10 sm:h-10 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm text-white px-4 py-3 rounded-2xl text-center">
                  <p className="text-sm font-medium">{t('palletScanner.pointCamera', 'Pointez la caméra vers le QR code')}</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={stopCamera}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-2xl shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
{t('palletScanner.stopScanner', 'Arrêter le scanner')}
                  </div>
                </button>
                <button
                  onClick={() => {
                    setScannedCode('');
                    setError('');
                    setPalletInfo(null);
                    setReceptionInfo(null);
                    setScanSuccess(false);
                  }}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold rounded-2xl shadow-lg shadow-gray-500/25 hover:shadow-xl hover:shadow-gray-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
{t('palletScanner.newScan', 'Nouveau scan')}
                  </div>
                </button>
                <button
                  onClick={() => {
                    // Test with a sample QR code
                    const testCode = 'TEST123';
                    console.log('🧪 Testing with sample code:', testCode);
                    setScannedCode(testCode);
                    searchPallet(testCode);
                  }}
                  className="group px-4 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
                  title="Tester avec un code d'exemple"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Success Message */}
          {scanSuccess && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl animate-pulse">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-800 font-semibold">
                  QR Code scanné avec succès ! Recherche en cours...
                </p>
              </div>
            </div>
          )}

          {/* Manual Input - Apple Style */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('palletScanner.manualInput', 'Saisie manuelle')}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={scannedCode}
                  onChange={handleManualInput}
                  placeholder={t('palletScanner.enterPalletQR', 'Entrez le QR code de la palette') as string}
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-500 transition-all duration-200 focus:bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !scannedCode.trim()}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="flex items-center justify-center">
                  {loading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
{t('palletScanner.searchPallet', 'Rechercher')}
                    </>
                  )}
                </div>
              </button>
            </form>
          </div>
        </div>

        {/* Results Section - Apple Style */}
        <div className="bg-white rounded-3xl shadow-xl shadow-blue-500/10 border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Résultats</h2>
            </div>

          {error && (
            <div className="mb-6 p-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-800 font-semibold text-lg mb-1">Erreur</p>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {scannedCode && !error && !palletInfo && (
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-blue-800 font-semibold text-lg mb-1">QR Code scanné avec succès !</p>
                  <p className="text-blue-700">Code: {scannedCode}</p>
                </div>
              </div>
            </div>
          )}

          {palletInfo && receptionInfo && (
            <div className="space-y-4">
              {/* Pallet Info - Apple Style */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl border border-gray-200">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Informations de la palette
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Référence</p>
                    <p className="text-lg font-bold text-gray-900 font-mono">{scannedCode}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Client</p>
                    <p className="text-lg font-bold text-gray-900">{receptionInfo.clientName}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Produit</p>
                    <p className="text-lg font-bold text-gray-900">{receptionInfo.productName}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Variété</p>
                    <p className="text-lg font-bold text-gray-900">{receptionInfo.productVariety}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Chambre</p>
                    <p className="text-lg font-bold text-gray-900">{receptionInfo.roomName}</p>
                  </div>
                  {receptionInfo.source && (
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Source</p>
                      <p className="text-lg font-bold text-gray-900">{receptionInfo.source}</p>
                    </div>
                  )}
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Date</p>
                    <p className="text-lg font-bold text-gray-900">
                      {receptionInfo.arrivalTime?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pallet Details - Apple Style */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {t('palletScanner.palletDetails', 'Détails de la palette')}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">{t('palletScanner.crateCount', 'Caisses sur cette palette')}</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {palletInfo.pallets?.find(p => p.reference === scannedCode)?.crates || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">{t('palletScanner.palletType', 'Type de palette')}</p>
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${palletInfo.pallets?.find(p => p.reference === scannedCode)?.isFull ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <p className="text-lg font-bold text-gray-900">
                        {palletInfo.pallets?.find(p => p.reference === scannedCode)?.isFull ? t('palletScanner.fullPallet', 'Complète') : t('palletScanner.partialPallet', 'Partielle')}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">{t('palletScanner.totalCrates', 'Total caisses réception')}</p>
                    <p className="text-2xl font-bold text-blue-600">{palletInfo.totalCrates}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">{t('palletScanner.cratesPerPallet', 'Capacité par palette')}</p>
                    <p className="text-2xl font-bold text-blue-600">{palletInfo.cratesPerPallet}</p>
                  </div>
                </div>
              </div>

              {/* Actions - Apple Style */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <button
                  onClick={() => {
                    setPalletInfo(null);
                    setReceptionInfo(null);
                    setScannedCode('');
                    setError('');
                    setScanSuccess(false);
                  }}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold rounded-2xl shadow-lg shadow-gray-500/25 hover:shadow-xl hover:shadow-gray-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Effacer
                  </div>
                </button>
                <button
                  onClick={() => searchPallet(scannedCode)}
                  className="group flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Actualiser
                  </div>
                </button>
              </div>
            </div>
          )}

          {!palletInfo && !error && !loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('palletScanner.noData', 'Aucune donnée à afficher')}</h3>
              <p className="text-gray-500">{t('palletScanner.scanToSeeInfo', 'Scannez un QR code pour voir les informations de la palette')}</p>
            </div>
          )}
        </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default PalletScannerPage;


