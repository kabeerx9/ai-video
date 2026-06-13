type ClerkErrorDetail = {
  code?: string;
  longMessage?: string;
  message?: string;
  meta?: {
    paramName?: string;
  };
};

type ClerkErrorLike = {
  errors?: ClerkErrorDetail[];
  longMessage?: string;
  message?: string;
};

function getErrorDetails(error: unknown): ClerkErrorDetail[] {
  if (!error || typeof error !== "object") {
    return [];
  }

  const details = (error as ClerkErrorLike).errors;
  return Array.isArray(details) ? details : [];
}

export function formatClerkAuthError(error: unknown, fallback: string) {
  const details = getErrorDetails(error);
  const passwordDisabled = details.some(
    (detail) =>
      (detail.code === "form_param_unknown" && detail.meta?.paramName === "password") ||
      (detail.code === "form_param_value_invalid" && detail.meta?.paramName === "strategy"),
  );
  const identifierExists = details.some((detail) => detail.code === "form_identifier_exists");

  if (passwordDisabled && identifierExists) {
    return "Password authentication is disabled for this Clerk project, and this email already has an account. Enable Password in Clerk Dashboard, then sign in instead.";
  }

  if (passwordDisabled) {
    return "Password authentication is disabled for this Clerk project. Enable it in Clerk Dashboard under User & authentication > Password.";
  }

  if (identifierExists) {
    return "An account already exists for this email address. Sign in instead.";
  }

  const firstDetail = details[0];
  if (firstDetail) {
    return firstDetail.longMessage ?? firstDetail.message ?? fallback;
  }

  if (error && typeof error === "object") {
    const clerkError = error as ClerkErrorLike;
    return clerkError.longMessage ?? clerkError.message ?? fallback;
  }

  return fallback;
}
