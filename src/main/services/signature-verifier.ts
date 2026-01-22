/**
 * PowerShell Script Signature Verification Service
 *
 * Provides cryptographic verification of PowerShell script signatures
 * to ensure only scripts signed with trusted enterprise certificates
 * are allowed to execute.
 */

import { execSync } from 'child_process';
import { app } from 'electron';
import { createServiceLogger, securityLogger } from './logger';

const logger = createServiceLogger('signature-verifier');

/**
 * Result of a signature verification operation.
 */
export interface SignatureResult {
  /** Whether the signature is cryptographically valid */
  isValid: boolean;
  /** Whether the script has any signature (valid or not) */
  isSigned: boolean;
  /** The PowerShell signature status string */
  status: SignatureStatus;
  /** The subject (CN) of the signing certificate */
  signerSubject?: string;
  /** The thumbprint of the signing certificate */
  signerThumbprint?: string;
  /** When the signing certificate expires */
  expiryDate?: Date;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Possible signature statuses from Get-AuthenticodeSignature.
 */
export type SignatureStatus =
  | 'Valid'
  | 'NotSigned'
  | 'HashMismatch'
  | 'NotTrusted'
  | 'UnknownError'
  | 'NotSupportedFileFormat'
  | 'Incompatible'
  | 'Error';

/**
 * Configuration for the signature verifier.
 */
export interface SignatureVerifierConfig {
  /** Array of trusted certificate thumbprints (uppercase, no spaces) */
  trustedThumbprints: string[];
  /** Whether to require signature verification (false in dev mode) */
  enforceSignatures: boolean;
  /** Whether to allow scripts signed by untrusted but valid certificates */
  allowUntrustedSignatures: boolean;
}

/**
 * Default configuration - enforce signatures in production.
 */
const defaultConfig: SignatureVerifierConfig = {
  trustedThumbprints: [],
  enforceSignatures: !isDevelopment(),
  allowUntrustedSignatures: false,
};

let currentConfig: SignatureVerifierConfig = { ...defaultConfig };

/**
 * Check if running in development mode.
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !app.isPackaged;
}

/**
 * Initialize the signature verifier with configuration.
 */
export function initializeSignatureVerifier(config: Partial<SignatureVerifierConfig>): void {
  currentConfig = {
    ...defaultConfig,
    ...config,
    // Normalize thumbprints to uppercase
    trustedThumbprints: (config.trustedThumbprints || []).map(t => t.toUpperCase().replace(/\s/g, '')),
  };

  logger.info('Signature verifier initialized', {
    enforceSignatures: currentConfig.enforceSignatures,
    trustedThumbprintCount: currentConfig.trustedThumbprints.length,
    isDevelopment: isDevelopment(),
  });
}

/**
 * Add a trusted certificate thumbprint at runtime.
 */
export function addTrustedThumbprint(thumbprint: string): void {
  const normalized = thumbprint.toUpperCase().replace(/\s/g, '');
  if (!currentConfig.trustedThumbprints.includes(normalized)) {
    currentConfig.trustedThumbprints.push(normalized);
    logger.info('Added trusted thumbprint', { thumbprint: normalized });
  }
}

/**
 * Get the current configuration (for debugging/display).
 */
export function getSignatureVerifierConfig(): Readonly<SignatureVerifierConfig> {
  return { ...currentConfig };
}

/**
 * Verify the authenticode signature of a PowerShell script.
 *
 * @param scriptPath - Full path to the .ps1 script file
 * @returns SignatureResult with verification details
 */
export function verifyScriptSignature(scriptPath: string): SignatureResult {
  const escapedPath = scriptPath.replace(/'/g, "''");

  // PowerShell command to get signature details as JSON
  const psCommand = `
    $ErrorActionPreference = 'Stop'
    try {
      $sig = Get-AuthenticodeSignature -FilePath '${escapedPath}'
      @{
        Status = $sig.Status.ToString()
        SignerSubject = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }
        SignerThumbprint = if ($sig.SignerCertificate) { $sig.SignerCertificate.Thumbprint } else { $null }
        NotAfter = if ($sig.SignerCertificate) { $sig.SignerCertificate.NotAfter.ToString('o') } else { $null }
        StatusMessage = $sig.StatusMessage
      } | ConvertTo-Json -Compress
    } catch {
      @{
        Status = 'Error'
        ErrorMessage = $_.Exception.Message
      } | ConvertTo-Json -Compress
    }
  `.trim();

  try {
    const result = execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "${psCommand.replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf8',
        timeout: 10000, // 10 second timeout
        windowsHide: true,
      }
    );

    const parsed = JSON.parse(result.trim());

    if (parsed.ErrorMessage) {
      logger.error('Signature verification error', {
        scriptPath,
        error: parsed.ErrorMessage,
      });
      return {
        isValid: false,
        isSigned: false,
        status: 'Error',
        error: parsed.ErrorMessage,
      };
    }

    const signatureResult: SignatureResult = {
      isValid: parsed.Status === 'Valid',
      isSigned: parsed.Status !== 'NotSigned',
      status: parsed.Status as SignatureStatus,
      signerSubject: parsed.SignerSubject || undefined,
      signerThumbprint: parsed.SignerThumbprint || undefined,
      expiryDate: parsed.NotAfter ? new Date(parsed.NotAfter) : undefined,
    };

    logger.debug('Signature verification completed', {
      scriptPath,
      status: signatureResult.status,
      isValid: signatureResult.isValid,
      signerThumbprint: signatureResult.signerThumbprint,
    });

    return signatureResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to verify script signature', {
      scriptPath,
      error: errorMessage,
    });

    return {
      isValid: false,
      isSigned: false,
      status: 'Error',
      error: errorMessage,
    };
  }
}

/**
 * Check if a script is signed by one of the trusted certificates.
 *
 * @param scriptPath - Full path to the .ps1 script file
 * @returns true if the script is validly signed by a trusted certificate
 */
export function isSignedByTrustedCert(scriptPath: string): boolean {
  const sig = verifyScriptSignature(scriptPath);

  if (!sig.isValid) {
    return false;
  }

  if (!sig.signerThumbprint) {
    return false;
  }

  const normalizedThumbprint = sig.signerThumbprint.toUpperCase().replace(/\s/g, '');
  return currentConfig.trustedThumbprints.includes(normalizedThumbprint);
}

/**
 * Validate a script for execution based on current signature policy.
 *
 * This is the main entry point for the execution flow.
 * It checks the signature and returns an error message if the script
 * should not be executed, or null if execution is allowed.
 *
 * @param scriptPath - Full path to the .ps1 script file
 * @param executionId - Execution ID for logging
 * @returns null if execution allowed, error message string if denied
 */
export function validateScriptForExecution(
  scriptPath: string,
  executionId: string
): string | null {
  // In development mode with enforcement disabled, skip checks
  if (!currentConfig.enforceSignatures) {
    logger.debug('Signature enforcement disabled, skipping verification', {
      executionId,
      scriptPath,
      isDevelopment: isDevelopment(),
    });
    return null;
  }

  const signatureResult = verifyScriptSignature(scriptPath);

  // Check if script is signed at all
  if (!signatureResult.isSigned) {
    securityLogger.error('Script execution denied: Script is not signed', {
      executionId,
      scriptPath,
      status: signatureResult.status,
    });
    return 'Script execution denied: Script is not signed';
  }

  // Check if signature is valid
  if (!signatureResult.isValid) {
    securityLogger.error('Script execution denied: Invalid signature', {
      executionId,
      scriptPath,
      status: signatureResult.status,
      signerThumbprint: signatureResult.signerThumbprint,
    });
    return `Script execution denied: Invalid signature (${signatureResult.status})`;
  }

  // Check if signed by trusted certificate
  if (!currentConfig.allowUntrustedSignatures) {
    const normalizedThumbprint = signatureResult.signerThumbprint?.toUpperCase().replace(/\s/g, '') || '';

    if (!currentConfig.trustedThumbprints.includes(normalizedThumbprint)) {
      securityLogger.error('Script execution denied: Not signed by trusted certificate', {
        executionId,
        scriptPath,
        signerThumbprint: normalizedThumbprint,
        signerSubject: signatureResult.signerSubject,
        trustedThumbprints: currentConfig.trustedThumbprints,
      });
      return 'Script execution denied: Not signed by trusted certificate';
    }
  }

  // Check certificate expiry
  if (signatureResult.expiryDate && signatureResult.expiryDate < new Date()) {
    securityLogger.warn('Script signed with expired certificate', {
      executionId,
      scriptPath,
      expiryDate: signatureResult.expiryDate.toISOString(),
      signerSubject: signatureResult.signerSubject,
    });
    // Note: We log a warning but don't block execution for expired certs
    // The signature is still cryptographically valid
  }

  // All checks passed
  securityLogger.info('Script signature verified', {
    executionId,
    scriptPath,
    signerSubject: signatureResult.signerSubject,
    signerThumbprint: signatureResult.signerThumbprint,
  });

  return null;
}

/**
 * Get a human-readable description of a signature status.
 */
export function getStatusDescription(status: SignatureStatus): string {
  switch (status) {
    case 'Valid':
      return 'The signature is valid and the certificate is trusted.';
    case 'NotSigned':
      return 'The script does not have a digital signature.';
    case 'HashMismatch':
      return 'The script has been modified since it was signed.';
    case 'NotTrusted':
      return 'The signing certificate is not trusted by the system.';
    case 'UnknownError':
      return 'An unknown error occurred during signature verification.';
    case 'NotSupportedFileFormat':
      return 'The file format does not support authenticode signatures.';
    case 'Incompatible':
      return 'The signature is incompatible with the current system.';
    case 'Error':
      return 'An error occurred while verifying the signature.';
    default:
      return 'Unknown signature status.';
  }
}
