-- CreateTable
CREATE TABLE "vetting_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'smile',
    "externalRef" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vetting_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vetting_sessions_userId_idx" ON "vetting_sessions"("userId");
CREATE INDEX "vetting_sessions_externalRef_idx" ON "vetting_sessions"("externalRef");

-- AddForeignKey
ALTER TABLE "vetting_sessions" ADD CONSTRAINT "vetting_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
