import { Timestamp } from '@/lib/db';

export interface CashValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CashMovementData {
  type: 'in' | 'out';
  amount: number;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'card';
  reason: string;
  clientId?: string;
  reference: string;
  notes?: string;
}

export interface CashContext {
  currentBalance: number;
  todayMovements: any[];
  pendingCollections: any[];
  lastMovementTime?: Date;
}

/**
 * Validates cash movement data
 */
export const validateCashMovement = (
  data: CashMovementData,
  context: CashContext
): CashValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Amount validation
  if (!data.amount || data.amount <= 0) {
    errors.push('Le montant doit être supérieur à 0');
  }

  if (data.amount > 100000) {
    warnings.push('Montant élevé détecté (>100,000 MAD). Veuillez vérifier.');
  }

  // Cash out validation
  if (data.type === 'out' && data.amount > context.currentBalance) {
    errors.push(`Solde insuffisant. Solde actuel: ${context.currentBalance} MAD`);
  }

  // Reference validation
  if (!data.reference || data.reference.trim().length < 3) {
    errors.push('La référence doit contenir au moins 3 caractères');
  }

  // Reason validation
  if (!data.reason || data.reason.trim().length < 5) {
    errors.push('La raison doit être détaillée (minimum 5 caractères)');
  }

  // Payment method validation
  const validMethods = ['cash', 'check', 'transfer', 'card'];
  if (!validMethods.includes(data.paymentMethod)) {
    errors.push('Méthode de paiement invalide');
  }

  // Check for duplicate references
  const duplicateRef = context.todayMovements.find(
    m => m.reference === data.reference
  );
  if (duplicateRef) {
    errors.push('Une référence similaire existe déjà aujourd\'hui');
  }

  // Check for suspicious patterns
  if (data.type === 'out' && data.amount > 5000) {
    warnings.push('Sortie de caisse importante. Assurez-vous d\'avoir l\'autorisation.');
  }

  // Check for rapid consecutive movements
  if (context.lastMovementTime) {
    const timeDiff = Date.now() - context.lastMovementTime.getTime();
    if (timeDiff < 30000) { // Less than 30 seconds
      warnings.push('Mouvement rapide détecté. Vérifiez la saisie.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validates caution/deposit amounts
 */
export const validateCautionAmount = (
  amount: number,
  depositPerCrate: number,
  maxCrates: number
): CashValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!amount || amount <= 0) {
    errors.push('Le montant de la caution doit être supérieur à 0');
  }

  const maxAmount = maxCrates * depositPerCrate;
  if (amount > maxAmount) {
    errors.push(`Le montant dépasse le maximum autorisé (${maxAmount} MAD)`);
  }

  const cratesCanTake = Math.floor(amount / depositPerCrate);
  if (cratesCanTake === 0) {
    warnings.push('Montant insuffisant pour prendre des caisses');
  }

  const remaining = amount % depositPerCrate;
  if (remaining > 0) {
    warnings.push(`Montant non optimal. Reste: ${remaining} MAD (${depositPerCrate} MAD par caisse)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validates cash reconciliation
 */
export const validateCashReconciliation = (
  expectedBalance: number,
  actualBalance: number,
  tolerance: number = 10
): CashValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const difference = Math.abs(expectedBalance - actualBalance);
  
  if (difference > tolerance) {
    errors.push(`Écart de réconciliation important: ${difference} MAD`);
  } else if (difference > 0) {
    warnings.push(`Petit écart détecté: ${difference} MAD`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Generates cash movement reference
 */
export const generateCashReference = (
  type: 'in' | 'out',
  existingReferences: string[]
): string => {
  const prefix = type === 'in' ? 'ENT' : 'SORT';
  const year = new Date().getFullYear();
  
  // Find the highest number for today
  let maxNumber = 0;
  const todayPrefix = `${prefix}-${year}-`;
  
  existingReferences.forEach(ref => {
    if (ref.startsWith(todayPrefix)) {
      const match = ref.match(new RegExp(`${todayPrefix}(\\d+)`));
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) maxNumber = num;
      }
    }
  });
  
  const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
  return `${todayPrefix}${nextNumber}`;
};

/**
 * Calculates cash flow metrics
 */
export const calculateCashFlowMetrics = (movements: any[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayMovements = movements.filter(m => 
    m.createdAt?.toDate?.() >= today
  );
  
  const thisWeekMovements = movements.filter(m => {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return m.createdAt?.toDate?.() >= weekAgo;
  });
  
  const totalIn = movements.filter(m => m.type === 'in')
    .reduce((sum, m) => sum + m.amount, 0);
    
  const totalOut = movements.filter(m => m.type === 'out')
    .reduce((sum, m) => sum + m.amount, 0);
    
  const todayIn = todayMovements.filter(m => m.type === 'in')
    .reduce((sum, m) => sum + m.amount, 0);
    
  const todayOut = todayMovements.filter(m => m.type === 'out')
    .reduce((sum, m) => sum + m.amount, 0);
    
  const weeklyIn = thisWeekMovements.filter(m => m.type === 'in')
    .reduce((sum, m) => sum + m.amount, 0);
    
  const weeklyOut = thisWeekMovements.filter(m => m.type === 'out')
    .reduce((sum, m) => sum + m.amount, 0);

  return {
    totalIn,
    totalOut,
    netFlow: totalIn - totalOut,
    todayIn,
    todayOut,
    todayNet: todayIn - todayOut,
    weeklyIn,
    weeklyOut,
    weeklyNet: weeklyIn - weeklyOut,
    movementCount: movements.length,
    todayMovementCount: todayMovements.length,
    averageMovement: movements.length > 0 ? (totalIn + totalOut) / movements.length : 0
  };
};
