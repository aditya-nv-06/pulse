CREATE TYPE "FeedbackSource" AS ENUM ('MANUAL', 'PASTE', 'CSV');
CREATE TYPE "InboxStatus" AS ENUM ('NEW', 'LINKED', 'CREATED', 'DISCARDED');

ALTER TABLE "Post" ADD COLUMN "voteCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Post" AS post
SET "voteCount" = (
  SELECT COUNT(*)::INTEGER FROM "Vote" AS vote WHERE vote."postId" = post."id"
);

CREATE TABLE "Requester" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Requester_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Requester_workspaceId_email_key" ON "Requester"("workspaceId", "email");
CREATE INDEX "Requester_workspaceId_createdAt_idx" ON "Requester"("workspaceId", "createdAt");
ALTER TABLE "Requester" ADD CONSTRAINT "Requester_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PostRequester" (
  "postId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostRequester_pkey" PRIMARY KEY ("postId", "requesterId")
);
CREATE INDEX "PostRequester_requesterId_idx" ON "PostRequester"("requesterId");
ALTER TABLE "PostRequester" ADD CONSTRAINT "PostRequester_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostRequester" ADD CONSTRAINT "PostRequester_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "Requester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InboxItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "source" "FeedbackSource" NOT NULL,
  "rawText" TEXT NOT NULL,
  "requesterName" TEXT,
  "requesterEmail" TEXT,
  "sourceNote" TEXT,
  "status" "InboxStatus" NOT NULL DEFAULT 'NEW',
  "suggestion" JSONB,
  "resultPostId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InboxItem_workspaceId_status_createdAt_idx"
  ON "InboxItem"("workspaceId", "status", "createdAt");
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
