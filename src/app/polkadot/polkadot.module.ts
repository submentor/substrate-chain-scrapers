import { Module, forwardRef } from '@nestjs/common';
import { PolkadotService } from './polkadot.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChainModule } from '../chain/chain.module';
import { ChainService } from '../chain/chain.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [forwardRef(() => ChainModule)],
  providers: [PolkadotService, ConfigService, PrismaService],
  exports: [PolkadotService],
})
export class PolkadotModule {}
