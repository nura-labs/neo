const firebaseErrors: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-email": "Invalid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password must be at least 6 characters with uppercase, lowercase, number, and special character.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/popup-closed-by-user": "Login popup was closed.",
  "auth/popup-blocked": "Login popup was blocked by your browser.",
  "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
  "auth/unauthorized-domain": "This domain is not authorized. Please contact support.",
  "auth/operation-not-allowed": "This sign-in method is not enabled.",
  "auth/password-does-not-meet-requirements": "Password must include uppercase, lowercase, number, and special character.",
};

export function getAuthErrorMessage(error: unknown): string {
  console.error("[Auth Error]", error);

  if (error && typeof error === "object") {
    // Firebase errors have a .code property directly
    const code = "code" in error ? (error as { code: string }).code : undefined;
    if (code && firebaseErrors[code]) {
      return firebaseErrors[code];
    }

    // Fallback: try to extract from message string
    if (error instanceof Error) {
      const match = error.message.match(/\(([^)]+)\)/);
      const fallbackCode = match?.[1];
      if (fallbackCode && firebaseErrors[fallbackCode]) {
        return firebaseErrors[fallbackCode];
      }
    }
  }

  return "Something went wrong. Please try again.";
}
