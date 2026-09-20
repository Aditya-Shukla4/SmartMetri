import { Prisma } from '@prisma/client';

export const createNotification = (tx: Prisma.TransactionClient, userId: string, type: string, title: string, message: string) => tx.notification.create({ data: { userId, type, title, message } });
