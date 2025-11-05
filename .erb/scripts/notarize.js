const { notarize } = require('@electron/notarize');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../../package.json');

// Remove quotes from value if present (handles both single and double quotes)
function removeQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

// Parse a single line from .env file
function parseEnvLine(trimmedLine) {
  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return null;
  }

  const equalIndex = trimmedLine.indexOf('=');
  if (equalIndex === -1) {
    return null;
  }

  const key = trimmedLine.slice(0, equalIndex).trim();
  const value = trimmedLine.slice(equalIndex + 1).trim();

  if (!key) {
    return null;
  }

  return { key, value: removeQuotes(value) };
}

// Load .env file if it exists (for local builds)
function loadEnvFile() {
  const envPath = path.join(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const parsed = parseEnvLine(line.trim());
    if (parsed && !(parsed.key in process.env)) {
      // Only set if not already in process.env (env vars take precedence)
      process.env[parsed.key] = parsed.value;
    }
  }
}

// Setup Apple app-specific password from environment variables
function setupApplePassword() {
  const applePassword =
    process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_ID_PASS;
  // Keep electron-builder compatibility: if only APPLE_ID_PASS is provided, mirror it
  if (!process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_ID_PASS) {
    process.env.APPLE_APP_SPECIFIC_PASSWORD = process.env.APPLE_ID_PASS;
  }
  return applePassword;
}

// Check if notarization should be enabled
function shouldEnableNotarization() {
  const isCI = process.env.CI === 'true';
  return isCI || process.env.ENABLE_NOTARIZATION === 'true';
}

// Validate credentials and log warnings if missing
function validateCredentials(applePassword) {
  const isCI = process.env.CI === 'true';
  const hasCredentials =
    process.env.APPLE_ID && applePassword && process.env.APPLE_TEAM_ID;

  if (hasCredentials) {
    return true;
  }

  const contextType = isCI ? 'CI' : 'local';
  console.warn(
    `Skipping notarization (${contextType} build). APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD (or APPLE_ID_PASS), and APPLE_TEAM_ID env variables must be set.`,
  );
  if (isCI) {
    console.warn(
      'To enable notarization in CI, add these as GitHub Secrets and set them in the workflow.',
    );
  } else {
    console.warn(
      'To enable notarization locally, add these to your .env file or set ENABLE_NOTARIZATION=true with env vars.',
    );
  }
  return false;
}

// Staple the notarization ticket to the app
async function stapleTicket(appPath) {
  console.log('Stapling notarization ticket to app...');
  try {
    // Sometimes the ticket needs a moment to be available, retry once
    try {
      execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
    } catch (firstAttemptError) {
      console.log(
        `First stapling attempt failed: ${firstAttemptError.message}`,
      );
      console.log('Waiting 2 seconds and retrying...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
    }
    console.log('Stapling completed successfully!');
  } catch (stapleError) {
    console.warn(
      'Stapling failed (this is non-critical):',
      stapleError.message,
    );
    // Don't fail the build if stapling fails - the app is still notarized
  }
}

// Verify Gatekeeper will accept the app
function verifyGatekeeper(appPath) {
  console.log('Verifying Gatekeeper acceptance...');
  try {
    execSync(`spctl --assess --verbose --type execute "${appPath}"`, {
      stdio: 'inherit',
    });
    console.log('Gatekeeper verification passed!');
  } catch (gatekeeperError) {
    console.warn(
      'Gatekeeper verification failed (app may still work):',
      gatekeeperError.message,
    );
    // Don't fail the build - notarization succeeded, this is just a verification
  }
}

exports.default = async function notarizeMacos(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Load .env file for local builds
  if (process.env.CI !== 'true') {
    loadEnvFile();
  }

  // Setup Apple password from environment variables
  const applePassword = setupApplePassword();

  // Determine if notarization should run
  if (!shouldEnableNotarization()) {
    console.log(
      'Skipping notarization (local build). Set ENABLE_NOTARIZATION=true to enable.',
    );
    return;
  }

  // Validate credentials
  if (!validateCredentials(applePassword)) {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log('Notarizing macOS app...');
  console.log(`App path: ${appPath}`);
  console.log(`Bundle ID: ${build.appId}`);
  console.log(`Team ID: ${process.env.APPLE_TEAM_ID}`);
  console.log(
    'Submitting to Apple for notarization (this may take 5-15 minutes)...',
  );

  try {
    console.log('Starting notarization...');

    await notarize({
      tool: 'notarytool',
      appBundleId: build.appId,
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: applePassword,
      teamId: process.env.APPLE_TEAM_ID,
    });
    console.log('Notarization completed successfully!');

    // Staple the notarization ticket to the app
    await stapleTicket(appPath);

    // Verify Gatekeeper will accept the app
    verifyGatekeeper(appPath);
  } catch (error) {
    console.error('Notarization failed:', error.message);
    if (
      error.message.includes('timeout') ||
      error.message.includes('network')
    ) {
      console.error(
        "This might be a network issue or Apple's servers are slow. Check your internet connection and try again.",
      );
      console.error(
        'You can check the status at: https://developer.apple.com/system-status/',
      );
    }
    throw error;
  }
};
