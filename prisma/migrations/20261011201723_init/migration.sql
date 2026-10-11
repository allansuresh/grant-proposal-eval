-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'EVALUATOR');

-- CreateEnum
CREATE TYPE "public"."EvalStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'EVALUATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Proposal" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'markdown',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "qualityLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Extraction" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Extraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Evaluation" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "status" "public"."EvalStatus" NOT NULL DEFAULT 'PENDING',
    "runsRequested" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EvalRun" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "runIndex" INTEGER NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "injectionFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CriterionScore" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "justification" TEXT NOT NULL,

    CONSTRAINT "CriterionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Proposal_ownerId_idx" ON "public"."Proposal"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Extraction_proposalId_key" ON "public"."Extraction"("proposalId");

-- CreateIndex
CREATE INDEX "Evaluation_proposalId_idx" ON "public"."Evaluation"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "EvalRun_evaluationId_runIndex_key" ON "public"."EvalRun"("evaluationId", "runIndex");

-- CreateIndex
CREATE INDEX "CriterionScore_runId_idx" ON "public"."CriterionScore"("runId");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "public"."UsageEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Proposal" ADD CONSTRAINT "Proposal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Extraction" ADD CONSTRAINT "Extraction_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "public"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Evaluation" ADD CONSTRAINT "Evaluation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "public"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvalRun" ADD CONSTRAINT "EvalRun_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "public"."Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CriterionScore" ADD CONSTRAINT "CriterionScore_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."EvalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
