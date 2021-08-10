import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { CronService } from './app/tasks/cron.service';
import { DiscordService } from './app/tasks/discord.service';
import { TasksService } from './app/tasks/tasks.service';
import { TasksConfig } from './configs/config.interface';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);
  const cronService = app.get(CronService);
  const taskService = app.get(TasksService);
  const taskConfig = configService.get<TasksConfig>('tasks');
  taskService.grabChainData(taskConfig.runAtStartup);
  const discordService = app.get(DiscordService);
  discordService.loginClient();

  cronService.getCronJobs();
}
bootstrap();
