import prisma from "@ai-video/db";
import { CreditTransactionType } from "@ai-video/db/types";
import type { User } from "@ai-video/db/types";
import type { Prisma } from "@ai-video/db/types";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

type CreditMutationOptions = {
  description?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function spendCredits(
  userId: string,
  amount: number,
  options: CreditMutationOptions = {},
): Promise<User> {
  if (amount <= 0) {
    throw new Error("Spend amount must be greater than zero");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.credits < amount) {
      throw new InsufficientCreditsError();
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: amount } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -amount,
        type: CreditTransactionType.SPEND,
        description: options.description,
        metadata: options.metadata,
      },
    });

    return updatedUser;
  });
}

export async function grantCredits(
  userId: string,
  amount: number,
  options: CreditMutationOptions = {},
): Promise<User> {
  if (amount <= 0) {
    throw new Error("Grant amount must be greater than zero");
  }

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount,
        type: CreditTransactionType.GRANT,
        description: options.description,
        metadata: options.metadata,
      },
    });

    return updatedUser;
  });
}
