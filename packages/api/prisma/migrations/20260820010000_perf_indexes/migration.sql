-- Perf: add covering/partial indexes for hot paths (from large-scale testing)
-- Covers: notifications list/unread tail (P1), events flat scan, admin/dashboard aggregates

-- Notifications: pagination by recency (list) and unread count (polled)
CREATE INDEX IF NOT EXISTS "idx_notify_user_created_desc" ON "notify_notifications" ("userId", "createdAt" DESC);
-- Partial index: only unread rows (fraction of table for active users) — speeds unreadCount and speeds list when filtering isRead=false
CREATE INDEX IF NOT EXISTS "idx_notify_unread_partial" ON "notify_notifications" ("userId", "createdAt" DESC) WHERE "isRead" = false;

-- Events: public browse path (F15) hits status='published' + startTime window
CREATE INDEX IF NOT EXISTS "idx_event_status_start_desc" ON "event_events" ("status", "startTime" DESC);
CREATE INDEX IF NOT EXISTS "idx_event_city_status" ON "event_events" ("city", "status");

-- Profile: nearby/discover hot path already has @@index([city,district,nearbyEnabled]) but add isComplete+isPaused filtering for matchable scan
CREATE INDEX IF NOT EXISTS "idx_profile_matchable" ON "profile_profiles" ("city", "isPaused", "isComplete", "updatedAt" DESC);

-- Chat: ensure conversation message scan is covered
CREATE INDEX IF NOT EXISTS "idx_message_conv_created" ON "chat_messages" ("conversationId", "createdAt" DESC);
