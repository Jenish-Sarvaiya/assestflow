import { Prisma } from '@prisma/client';

/**
 * Serializes workflow changes for a single asset. Allocation, booking, return,
 * maintenance, and transfer transitions all take this lock before mutating state.
 */
export async function lockAssetForWorkflow(tx: Prisma.TransactionClient, assetId: number): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: number }[]>(
    Prisma.sql`SELECT id FROM Asset WHERE id = ${assetId} FOR UPDATE`
  );

  return rows.length === 1;
}
