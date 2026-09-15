import { IsEnum } from 'class-validator';
import { JobStatus } from '../job.entity';

export class UpdateStatusDto {
  @IsEnum(JobStatus, {
    message: `status must be one of: ${Object.values(JobStatus).join(', ')}`,
  })
  status: JobStatus;
}
