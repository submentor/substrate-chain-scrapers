import { Module } from '@nestjs/common';
import { ChainModule } from './chain/chain.module';
import { AppService } from './app.service';
import { ChainService } from './chain/chain.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PolkadotModule } from './polkadot/polkadot.module';
import config from '../configs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PolkadotModule,
    ChainModule,
  ],
  providers: [
    AppService,
    PrismaService,
    ConfigService,
    ChainService,
  ],
})
export class AppModule {}
