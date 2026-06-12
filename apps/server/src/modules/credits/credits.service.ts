import {
  InsufficientCreditsError,
  refundCredits,
  spendCredits,
} from "@/services/credits";
import type {
  CreditMutationOptions,
  ICreditsService,
} from "@/modules/credits/credits.service.interface";

export class CreditsService implements ICreditsService {
  spendCredits(userId: string, amount: number, options?: CreditMutationOptions) {
    return spendCredits(userId, amount, options);
  }

  refundCredits(userId: string, amount: number, options?: CreditMutationOptions) {
    return refundCredits(userId, amount, options);
  }
}

export { InsufficientCreditsError };
