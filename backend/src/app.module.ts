import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsModule } from './jobs/jobs.module';
import { Job } from './jobs/job.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH || 'job-queue.sqlite',
      entities: [Job],
      // Fine for this take-home project. In a real production system this
      // would be replaced with proper migrations (see README).
      synchronize: true,
    }),
    JobsModule,
  ],
})
export class AppModule {}
