import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from './job.entity';
import { CreateJobDto } from './dto/create-job.dto';

// The single source of truth for the job state machine. Enforced ONLY here,
// on the backend, because the frontend (or any other client hitting the API
// directly) cannot be trusted to respect it.
const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.RUNNING, JobStatus.FAILED],
  [JobStatus.RUNNING]: [JobStatus.COMPLETED, JobStatus.FAILED],
  [JobStatus.COMPLETED]: [], // terminal
  [JobStatus.FAILED]: [], // terminal
};

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
  ) {}

  create(dto: CreateJobDto): Promise<Job> {
    const job = this.jobsRepository.create({
      title: dto.title.trim(),
      type: dto.type,
      status: JobStatus.PENDING,
    });
    return this.jobsRepository.save(job);
  }

  findAll(status?: JobStatus): Promise<Job[]> {
    return this.jobsRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOrFail(id: string): Promise<Job> {
    const job = await this.jobsRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Job with id "${id}" was not found`);
    }
    return job;
  }

  async remove(id: string): Promise<void> {
    const result = await this.jobsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Job with id "${id}" was not found`);
    }
  }

  /**
   * Updates a job's status, enforcing:
   *  1. The state machine (e.g. completed/failed are terminal).
   *  2. Safe concurrent updates: if two requests race to change the same
   *     job at the same time, only ONE of them can win. The other gets a
   *     409 Conflict instead of silently corrupting state.
   *
   * Concurrency strategy: a single atomic conditional UPDATE
   * ("UPDATE jobs SET status = ? WHERE id = ? AND status = ?"), rather than
   * a naive "read job, check in JS, then write" sequence. The naive
   * approach has a race window between the read and the write where a
   * second request can slip in. Because relational databases execute a
   * single UPDATE statement atomically, using the *previously observed
   * status* as part of the WHERE clause guarantees that if two requests
   * both try to move the same job out of `pending` at the same time, the
   * database itself serializes them: exactly one UPDATE affects a row,
   * the other affects zero rows and is treated as a conflict.
   *
   * This works out of the box on both SQLite and Postgres and needs no
   * external locking (Redis locks, SELECT ... FOR UPDATE, etc.), which
   * would be overkill for this system's scale.
   */
  async updateStatus(id: string, newStatus: JobStatus): Promise<Job> {
    const job = await this.findOneOrFail(id);
    const currentStatus = job.status;

    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (currentStatus === newStatus) {
      throw new ConflictException(
        `Job is already "${currentStatus}"`,
      );
    }
    if (!allowedNext.includes(newStatus)) {
      throw new ConflictException(
        `Invalid transition: "${currentStatus}" -> "${newStatus}". ` +
          `Allowed next states from "${currentStatus}": ` +
          `${allowedNext.length ? allowedNext.join(', ') : '(none, terminal state)'}`,
      );
    }

    // Atomic, conditional write: only succeeds if the row's status still
    // matches what we just read. This is what actually closes the race
    // window between two near-simultaneous requests.
    const result = await this.jobsRepository
      .createQueryBuilder()
      .update(Job)
      .set({ status: newStatus })
      .where('id = :id', { id })
      .andWhere('status = :currentStatus', { currentStatus })
      .execute();

    if (result.affected === 0) {
      // Someone else changed the job's status between our read and our
      // write (e.g. the other browser tab won the race).
      throw new ConflictException(
        'Job status was changed by another request in the meantime. ' +
          'Please refresh and try again.',
      );
    }

    return this.findOneOrFail(id);
  }
}
