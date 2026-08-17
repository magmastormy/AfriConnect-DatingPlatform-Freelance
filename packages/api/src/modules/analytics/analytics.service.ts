import { IAnalyticsRepository } from './analytics.repository';
import { AnalyticsBundle } from './analytics.types';

export interface IAnalyticsService {
  recordView(viewerId: string, viewedUserId: string): Promise<boolean>;
  getBundle(userId: string, windowDays: 7 | 30 | 90): Promise<AnalyticsBundle>;
}

export class AnalyticsService implements IAnalyticsService {
  constructor(private readonly repo: IAnalyticsRepository) {}

  recordView(viewerId: string, viewedUserId: string): Promise<boolean> {
    return this.repo.recordView(viewerId, viewedUserId);
  }

  getBundle(userId: string, windowDays: 7 | 30 | 90): Promise<AnalyticsBundle> {
    return this.repo.getBundle(userId, windowDays);
  }
}
