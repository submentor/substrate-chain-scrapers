import { Module, HttpModule, forwardRef } from '@nestjs/common';

import { PolkadotModule } from '../polkadot/polkadot.module';
import { PolkadotService } from '../polkadot/polkadot.service';
import { ChainService } from './chain.service';
import { SidecarService } from './sidecar.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [HttpModule, forwardRef(() => PolkadotModule)],
  providers: [ChainService, SidecarService, PrismaService],
  exports: [ChainService, SidecarService],
})
export class ChainModule {}
