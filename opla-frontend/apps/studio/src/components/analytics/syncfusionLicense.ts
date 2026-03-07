let licenseRegistered = false;

export async function ensureSyncfusionLicense() {
  if (licenseRegistered) {
    return;
  }

  const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY || import.meta.env.VITE_SYNCFUSION_API_KEY || '';

  const { registerLicense } = await import('@syncfusion/ej2-base');
  registerLicense(licenseKey);
  licenseRegistered = true;
}