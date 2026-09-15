import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JobStatus } from './job.entity';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.create(dto);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    // Validate the optional ?status= filter manually rather than with a DTO,
    // since it's a query param, not a body.
    if (
      status !== undefined &&
      !Object.values(JobStatus).includes(status as JobStatus)
    ) {
      throw new BadRequestException(
        `Invalid status filter "${status}". Must be one of: ${Object.values(JobStatus).join(', ')}`,
      );
    }
    return this.jobsService.findAll(status as JobStatus | undefined);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.jobsService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    await this.jobsService.remove(id);
  }
}
