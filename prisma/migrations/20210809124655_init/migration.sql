-- CreateEnum
CREATE TYPE "ChainUpdateType" AS ENUM ('ACCOUNT', 'VALIDATOR', 'NOMINATOR');

-- CreateTable
CREATE TABLE "Chain" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "updateStartedAt" TIMESTAMP(3),
    "lastUpdatedAt" TIMESTAMP(3),
    "lastGrabbedBlock" INTEGER,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainUpdates" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "type" "ChainUpdateType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "number" INTEGER NOT NULL,
    "authoredById" TEXT,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,

    PRIMARY KEY ("number")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" BIGSERIAL NOT NULL,
    "index" INTEGER NOT NULL,
    "eventIndex" TEXT,
    "blockNumber" INTEGER NOT NULL,
    "blockDate" TIMESTAMP(3),
    "section" TEXT,
    "method" TEXT,
    "data" JSONB NOT NULL,
    "applyExtrinsic" INTEGER,
    "phase" JSONB,
    "topics" JSONB,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extrinsic" (
    "id" BIGSERIAL NOT NULL,
    "index" INTEGER NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "blockDate" TIMESTAMP(3),
    "section" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "isSigned" BOOLEAN,
    "signer" TEXT,
    "nonce" BIGINT,
    "tip" DECIMAL(65,30),

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "index" INTEGER NOT NULL,
    "startBlockNumber" INTEGER NOT NULL,

    PRIMARY KEY ("index")
);

-- CreateTable
CREATE TABLE "Era" (
    "index" INTEGER NOT NULL,
    "eraStartSessionIndex" INTEGER NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL,
    "totalStake" DECIMAL(65,30) NOT NULL,
    "validatorsRewards" DECIMAL(65,30) NOT NULL,
    "validatorsArrLength" INTEGER,

    PRIMARY KEY ("index")
);

-- CreateTable
CREATE TABLE "EraPayout" (
    "id" TEXT NOT NULL,
    "madeInEraIndex" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountAddress" TEXT NOT NULL,
    "eventId" BIGINT NOT NULL,
    "extrinsicId" BIGINT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "blockDate" TIMESTAMP(3) NOT NULL,
    "payout" DECIMAL(65,30) NOT NULL,
    "paidById" TEXT,
    "paidByAccount" TEXT NOT NULL,
    "paidForEraIndex" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EraValidator" (
    "eraIndex" INTEGER NOT NULL,
    "validatorId" TEXT,
    "validatorAddress" TEXT NOT NULL,
    "nominatorsArrLength" INTEGER,
    "points" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "totalStake" DECIMAL(65,30) NOT NULL,
    "ownStake" DECIMAL(65,30) NOT NULL,
    "othersStake" DECIMAL(65,30) NOT NULL,
    "blocked" BOOLEAN NOT NULL,
    "stash" DECIMAL(65,30),

    PRIMARY KEY ("eraIndex","validatorAddress")
);

-- CreateTable
CREATE TABLE "EraNominator" (
    "eraIndex" INTEGER NOT NULL,
    "validatorId" TEXT,
    "validatorAddress" TEXT NOT NULL,
    "nominatorId" TEXT,
    "bonded" DECIMAL(65,30) NOT NULL,
    "stash" DECIMAL(65,30),
    "nominatorAddress" TEXT NOT NULL,

    PRIMARY KEY ("eraIndex","validatorAddress","nominatorAddress")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "display" TEXT,
    "parent" TEXT,
    "displayParent" TEXT,
    "email" TEXT,
    "web" TEXT,
    "twitter" TEXT,
    "legal" TEXT,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL,
    "freeBalance" DECIMAL(65,30) NOT NULL,
    "bonded" DECIMAL(65,30) NOT NULL,
    "isValidator" BOOLEAN,
    "validatorId" TEXT,
    "isNominator" BOOLEAN,
    "nominatorId" TEXT,
    "nonce" BIGINT,
    "identityId" TEXT,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validator" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "stashId" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL,
    "freeBalance" DECIMAL(65,30) NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "bonded" DECIMAL(65,30) NOT NULL,
    "identityId" TEXT,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nominator" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL,
    "freeBalance" DECIMAL(65,30) NOT NULL,
    "bonded" DECIMAL(65,30) NOT NULL,
    "identityId" TEXT,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidatorsNominators" (
    "validatorId" TEXT NOT NULL,
    "nominatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("validatorId","nominatorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chain.name_unique" ON "Chain"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ChainUpdates.chainId_type_unique" ON "ChainUpdates"("chainId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Block.hash_unique" ON "Block"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "Block_authoredById_unique" ON "Block"("authoredById");

-- CreateIndex
CREATE UNIQUE INDEX "Event.index_blockNumber_unique" ON "Event"("index", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Extrinsic.index_blockNumber_unique" ON "Extrinsic"("index", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Session.startBlockNumber_unique" ON "Session"("startBlockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Era_eraStartSessionIndex_unique" ON "Era"("eraStartSessionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "EraPayout.madeInEraIndex_accountId_eventId_extrinsicId_unique" ON "EraPayout"("madeInEraIndex", "accountId", "eventId", "extrinsicId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity.accountId_unique" ON "Identity"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Account.accountId_unique" ON "Account"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_validatorId_unique" ON "Account"("validatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_nominatorId_unique" ON "Account"("nominatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_identityId_unique" ON "Account"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "Validator.accountId_unique" ON "Validator"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Validator_identityId_unique" ON "Validator"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "Nominator.accountId_unique" ON "Nominator"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Nominator_identityId_unique" ON "Nominator"("identityId");

-- AddForeignKey
ALTER TABLE "ChainUpdates" ADD FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD FOREIGN KEY ("authoredById") REFERENCES "Validator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD FOREIGN KEY ("blockNumber") REFERENCES "Block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extrinsic" ADD FOREIGN KEY ("blockNumber") REFERENCES "Block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD FOREIGN KEY ("startBlockNumber") REFERENCES "Block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Era" ADD FOREIGN KEY ("eraStartSessionIndex") REFERENCES "Session"("index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraPayout" ADD FOREIGN KEY ("madeInEraIndex") REFERENCES "Era"("index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraPayout" ADD FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraPayout" ADD FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraPayout" ADD FOREIGN KEY ("extrinsicId") REFERENCES "Extrinsic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraPayout" ADD FOREIGN KEY ("blockNumber") REFERENCES "Block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraPayout" ADD FOREIGN KEY ("paidById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraPayout" ADD FOREIGN KEY ("paidForEraIndex") REFERENCES "Era"("index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraValidator" ADD FOREIGN KEY ("eraIndex") REFERENCES "Era"("index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraValidator" ADD FOREIGN KEY ("validatorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraNominator" ADD FOREIGN KEY ("eraIndex") REFERENCES "Era"("index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraNominator" ADD FOREIGN KEY ("validatorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EraNominator" ADD FOREIGN KEY ("nominatorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD FOREIGN KEY ("validatorId") REFERENCES "Validator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD FOREIGN KEY ("nominatorId") REFERENCES "Nominator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validator" ADD FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nominator" ADD FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidatorsNominators" ADD FOREIGN KEY ("validatorId") REFERENCES "Validator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidatorsNominators" ADD FOREIGN KEY ("nominatorId") REFERENCES "Nominator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
