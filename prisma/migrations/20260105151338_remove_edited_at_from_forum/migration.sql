/*
  Warnings:

  - You are about to drop the column `editedAt` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `editedAt` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "editedAt";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "editedAt";
