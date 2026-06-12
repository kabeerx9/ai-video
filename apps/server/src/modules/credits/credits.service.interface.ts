import type { User } from "@ai-video/db/types";
import type { Prisma } from "@ai-video/db/types";

export type CreditMutationOptions = {
  description?: string;
  metadata?: Prisma.InputJsonValue;
};

export interface ICreditsService {
  spendCredits(userId: string, amount: number, options?: CreditMutationOptions): Promise<User>;
  refundCredits(userId: string, amount: number, options?: CreditMutationOptions): Promise<User>;
}
