import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Allowed job "types" for this mini system. Kept as a fixed list so bad
// input can't silently create inconsistent categories. Easy to extend.
export const ALLOWED_JOB_TYPES = [
  'email',
  'report',
  'data-sync',
  'image-processing',
  'other',
] as const;

export class CreateJobDto {
  @IsString()
  @IsNotEmpty({ message: 'title must not be empty' })
  @MaxLength(200)
  title: string;

  @IsString()
  @IsIn(ALLOWED_JOB_TYPES, {
    message: `type must be one of: ${ALLOWED_JOB_TYPES.join(', ')}`,
  })
  type: string;
}
