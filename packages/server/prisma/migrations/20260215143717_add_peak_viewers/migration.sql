-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Stream" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "game" TEXT,
    "titleHistory" TEXT,
    "gameHistory" TEXT,
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME
);
INSERT INTO "new_Stream" ("endedAt", "game", "gameHistory", "id", "startedAt", "title", "titleHistory") SELECT "endedAt", "game", "gameHistory", "id", "startedAt", "title", "titleHistory" FROM "Stream";
DROP TABLE "Stream";
ALTER TABLE "new_Stream" RENAME TO "Stream";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
