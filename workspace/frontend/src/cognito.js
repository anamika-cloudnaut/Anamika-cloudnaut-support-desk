import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js'

// Runtime config is fetched from /config.json (written into the S3 bucket by
// CDK at deploy time), so Cognito pool IDs are not baked into the build.
let _configPromise = null

export function loadConfig() {
  if (!_configPromise) {
    _configPromise = fetch('/config.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config load failed'))))
      .catch(() => ({
        // Local-dev fallback via Vite env vars.
        region: import.meta.env.VITE_COGNITO_REGION,
        userPoolId: import.meta.env.VITE_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_CLIENT_ID,
        apiUrl: import.meta.env.VITE_API_URL || '/api',
      }))
  }
  return _configPromise
}

async function getPool() {
  const cfg = await loadConfig()
  if (!cfg.userPoolId || !cfg.userPoolClientId) {
    throw new Error('Cognito is not configured for this environment.')
  }
  return new CognitoUserPool({
    UserPoolId: cfg.userPoolId,
    ClientId: cfg.userPoolClientId,
  })
}

/**
 * Sign in with email + password.
 * Resolves with:
 *   { status: 'OK', idToken, user }                      -> signed in
 *   { status: 'NEW_PASSWORD_REQUIRED', cognitoUser, userAttributes } -> must set a new password
 * Rejects with an Error on failure.
 */
export async function signIn(email, password) {
  const pool = await getPool()
  const cognitoUser = new CognitoUser({ Username: email, Pool: pool })
  const authDetails = new AuthenticationDetails({ Username: email, Password: password })

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(buildSession(session)),
      onFailure: (err) => reject(new Error(err.message || 'Sign-in failed.')),
      newPasswordRequired: (userAttributes) => {
        // Cognito forbids re-submitting these immutable attributes.
        delete userAttributes.email_verified
        delete userAttributes.email
        resolve({ status: 'NEW_PASSWORD_REQUIRED', cognitoUser, userAttributes })
      },
      // User has TOTP MFA enabled: Cognito asks for the 6-digit code.
      totpRequired: () => {
        resolve({ status: 'MFA_REQUIRED', cognitoUser })
      },
      // Pool requires MFA but user hasn't set it up yet: enroll during login.
      mfaSetup: () => {
        cognitoUser.associateSoftwareToken({
          associateSecretCode: (secret) => resolve({ status: 'MFA_SETUP', cognitoUser, secret }),
          onFailure: (err) => reject(new Error(err.message || 'Could not start MFA setup.')),
        })
      },
    })
  })
}

/** Submit the 6-digit TOTP code for the MFA login challenge. */
export function sendMfaCode(cognitoUser, code) {
  return new Promise((resolve, reject) => {
    cognitoUser.sendMFACode(
      code.trim(),
      {
        onSuccess: (session) => resolve(buildSession(session)),
        onFailure: (err) => reject(new Error(friendlyMfaError(err))),
      },
      'SOFTWARE_TOKEN_MFA',
    )
  })
}

/** Complete the forced password change for a first-time / migrated user. */
export function completeNewPassword(cognitoUser, newPassword, userAttributes) {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, userAttributes || {}, {
      onSuccess: (session) => resolve(buildSession(session)),
      onFailure: (err) => reject(new Error(err.message || 'Could not set the new password.')),
    })
  })
}

/** Change the password for the currently signed-in user. */
export async function changePassword(oldPassword, newPassword) {
  const pool = await getPool()
  const cognitoUser = pool.getCurrentUser()
  if (!cognitoUser) {
    throw new Error('You are not signed in. Please sign in again and retry.')
  }
  return new Promise((resolve, reject) => {
    // Load the stored session first so changePassword has a valid access token.
    cognitoUser.getSession((sessionErr, session) => {
      if (sessionErr || !session || !session.isValid()) {
        return reject(new Error('Your session has expired. Please sign out and sign in again.'))
      }
      cognitoUser.changePassword(oldPassword, newPassword, (changeErr) => {
        if (!changeErr) return resolve({ status: 'OK' })
        reject(new Error(friendlyChangePasswordError(changeErr)))
      })
    })
  })
}

// Map Cognito's raw error codes to clear, actionable messages.
function friendlyChangePasswordError(err) {
  const code = err && (err.code || err.name)
  switch (code) {
    case 'NotAuthorizedException':
      return 'Your current password is incorrect.'
    case 'InvalidPasswordException':
      return 'The new password does not meet the requirements (min 12 chars, with upper, lower, number and symbol).'
    case 'InvalidParameterException':
      return 'Please check the password fields and try again.'
    case 'LimitExceededException':
      return 'Too many attempts. Please wait a few minutes and try again.'
    default:
      return (err && err.message) || 'Could not change your password.'
  }
}

/** Start the forgot-password flow (Cognito emails a code). */
export async function forgotPassword(email) {
  const pool = await getPool()
  const cognitoUser = new CognitoUser({ Username: email, Pool: pool })
  return new Promise((resolve, reject) => {
    cognitoUser.forgotPassword({
      onSuccess: () => resolve({ status: 'OK' }),
      onFailure: (err) => reject(new Error(err.message || 'Could not start password reset.')),
      inputVerificationCode: () => resolve({ status: 'CODE_SENT', cognitoUser }),
    })
  })
}

/** Confirm the forgot-password flow with the emailed code + new password. */
export async function confirmForgotPassword(email, code, newPassword) {
  const pool = await getPool()
  const cognitoUser = new CognitoUser({ Username: email, Pool: pool })
  return new Promise((resolve, reject) => {
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => resolve({ status: 'OK' }),
      onFailure: (err) => reject(new Error(err.message || 'Could not reset password.')),
    })
  })
}

// ---------------------------------------------------------------------------
// TOTP MFA (authenticator app) — enroll / status / disable
// ---------------------------------------------------------------------------

// Load the current signed-in user with a valid session, or throw.
async function currentUserWithSession() {
  const pool = await getPool()
  const cognitoUser = pool.getCurrentUser()
  if (!cognitoUser) throw new Error('You are not signed in. Please sign in again.')
  await new Promise((resolve, reject) => {
    cognitoUser.getSession((err, session) => {
      if (err || !session || !session.isValid()) {
        return reject(new Error('Your session has expired. Please sign in again.'))
      }
      resolve()
    })
  })
  return cognitoUser
}

/** Whether TOTP MFA is currently enabled for the signed-in user. */
export async function getMfaStatus() {
  const cognitoUser = await currentUserWithSession()
  return new Promise((resolve, reject) => {
    cognitoUser.getUserData(
      (err, data) => {
        if (err) return reject(new Error(err.message || 'Could not load MFA status.'))
        const settings = (data && data.UserMFASettingList) || []
        resolve({ enabled: settings.includes('SOFTWARE_TOKEN_MFA') })
      },
      { bypassCache: true },
    )
  })
}

/**
 * Begin TOTP enrollment: returns a secret + an otpauth:// URL for a QR code.
 * The user scans it in an authenticator app, then calls verifyMfaSetup(code).
 */
export async function startMfaSetup() {
  const cognitoUser = await currentUserWithSession()
  return new Promise((resolve, reject) => {
    cognitoUser.associateSoftwareToken({
      associateSecretCode: (secret) => {
        const label = encodeURIComponent(cognitoUser.getUsername() || 'account')
        const issuer = encodeURIComponent('Cloudnaut Support Desk')
        const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`
        resolve({ secret, otpauthUrl })
      },
      onFailure: (err) => reject(new Error(err.message || 'Could not start MFA setup.')),
    })
  })
}

/** Verify the first TOTP code and enable TOTP MFA for the user. */
export async function verifyMfaSetup(code) {
  const cognitoUser = await currentUserWithSession()
  return new Promise((resolve, reject) => {
    cognitoUser.verifySoftwareToken(code.trim(), 'Authenticator', {
      onSuccess: () => {
        cognitoUser.setUserMfaPreference(
          null,
          { PreferredMfa: true, Enabled: true },
          (err) => {
            if (err) return reject(new Error(err.message || 'Could not enable MFA.'))
            resolve({ status: 'ENABLED' })
          },
        )
      },
      onFailure: (err) => reject(new Error(friendlyMfaError(err))),
    })
  })
}

/** Disable TOTP MFA for the signed-in user. */
export async function disableMfa() {
  const cognitoUser = await currentUserWithSession()
  return new Promise((resolve, reject) => {
    cognitoUser.setUserMfaPreference(
      null,
      { PreferredMfa: false, Enabled: false },
      (err) => {
        if (err) return reject(new Error(err.message || 'Could not disable MFA.'))
        resolve({ status: 'DISABLED' })
      },
    )
  })
}

function friendlyMfaError(err) {
  const code = err && (err.code || err.name)
  switch (code) {
    case 'EnableSoftwareTokenMFAException':
    case 'CodeMismatchException':
      return 'That code is incorrect or expired. Open your authenticator app and enter the current 6-digit code.'
    case 'ExpiredCodeException':
      return 'That code has expired. Enter the current 6-digit code from your authenticator app.'
    case 'LimitExceededException':
      return 'Too many attempts. Please wait a few minutes and try again.'
    default:
      return (err && err.message) || 'MFA verification failed.'
  }
}

/** Return a stored valid ID token (refreshing if needed), or null. */
export async function getIdToken() {
  const pool = await getPool()
  const cognitoUser = pool.getCurrentUser()
  if (!cognitoUser) return null
  return new Promise((resolve) => {
    cognitoUser.getSession((err, session) => {
      if (err || !session || !session.isValid()) return resolve(null)
      resolve(session.getIdToken().getJwtToken())
    })
  })
}

export async function signOut() {
  const pool = await getPool()
  const cognitoUser = pool.getCurrentUser()
  if (cognitoUser) cognitoUser.signOut()
}

function buildSession(session) {
  const idToken = session.getIdToken()
  const payload = idToken.decodePayload()
  const groups = payload['cognito:groups'] || []
  const precedence = { admin: 1, support: 2, employee: 3 }
  const role = groups
    .filter((g) => g in precedence)
    .sort((a, b) => precedence[a] - precedence[b])[0] || null
  return {
    status: 'OK',
    idToken: idToken.getJwtToken(),
    user: {
      email: (payload.email || '').toLowerCase(),
      name: payload.name || payload.email,
      role,
    },
  }
}
