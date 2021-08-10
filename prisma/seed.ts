import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

const prisma = new PrismaClient();

async function main() {
  dotenv.config();
  console.log('Seeding...');

  const chain = await prisma.chain.create({
    data: {
      id: 'Polkadot',
      name: 'Polkadot',
    },
  });

  console.log(chain);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
