import { GraphQLModule } from '@nestjs/graphql';
import { Module } from '@nestjs/common';
import { AppService } from './app/app.service';
import { AuthModule } from './resolvers/auth/auth.module';
import { UserModule } from './resolvers/user/user.module';
import { PostModule } from './resolvers/post/post.module';
import { AppResolver } from './resolvers/app.resolver';
import { AppController } from './controllers/app.controller';
import { SidecarController } from './controllers/sidecar.controller';
import { DiscordController } from './controllers/discord.controller';
import { PolkadotModule } from './app/polkadot/polkadot.module';
import { ChainModule } from './app/chain/chain.module';
import { DateScalar } from './common/scalars/date.scalar';
import { ChainService } from './app/chain/chain.service';
import { PrismaService } from './app/prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from './configs/config';
import { GraphqlConfig } from './configs/config.interface';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    GraphQLModule.forRootAsync({
      useFactory: async (configService: ConfigService) => {
        const graphqlConfig = configService.get<GraphqlConfig>('graphql');
        return {
          installSubscriptionHandlers: true,
          buildSchemaOptions: {
            numberScalarMode: 'integer',
          },
          sortSchema: graphqlConfig.sortSchema,
          autoSchemaFile:
            graphqlConfig.schemaDestination || './src/schema.graphql',
          debug: graphqlConfig.debug,
          playground: graphqlConfig.playgroundEnabled,
          context: ({ req }) => ({ req }),
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    PostModule,
    PolkadotModule,
    ChainModule,
  ],
  providers: [
    AppResolver,
    DateScalar,
    PrismaService,
    ConfigService,
    ChainService,
  ],
  controllers: [AppController, DiscordController, SidecarController],
})
export class ServerModule {}
