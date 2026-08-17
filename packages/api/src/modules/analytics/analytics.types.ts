export interface Bucket {
  /** UTC day key, YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface AnalyticsBundle {
  windowDays: 7 | 30 | 90;
  startDate: string; // ISO
  endDate: string; // ISO
  series: {
    profileViews: Bucket[];
    likesSent: Bucket[];
    likesReceived: Bucket[];
    mutualMatches: Bucket[];
    eventsRsvpd: Bucket[];
  };
  totals: {
    profileViews: number;
    likesSent: number;
    likesReceived: number;
    mutualMatches: number;
    eventsRsvpd: number;
  };
}
