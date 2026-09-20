// @ts-nocheck
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
    console.log("[*] Injecting Universal God Mode Checklist...");
    await prisma.checklistTemplate.create({
        data: {
            name: 'Universal Hackathon Checklist',
            instrumentType: null,
            active: true,
            items: {
                create: [
                    {
                        // 🔥 FIX YAHAN HAI: Prisma ko 'label' chahiye tha, 'name' nahi!
                        label: 'Verified physically in field',
                        required: true
                    }
                ]
            }
        }
    });
    console.log("🔥 KAAM HO GAYA! Database is now strictly satisfied.");
}

fix().catch(console.error).finally(() => prisma.$disconnect());