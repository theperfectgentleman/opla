let licenseRegistered = false;

export async function ensureSyncfusionLicense() {
  if (licenseRegistered) {
    return;
  }

  const { registerLicense } = await import('@syncfusion/ej2-base');
  registerLicense(import.meta.env.VITE_SYNCFUSION_LICENSE_KEY || '');
  licenseRegistered = true;
}