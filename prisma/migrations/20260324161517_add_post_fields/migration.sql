/*
  Warnings:

  - Added the required column `device_master` to the `posts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "course_id" UUID,
ADD COLUMN     "device_master" UUID NOT NULL,
ADD COLUMN     "device_slave" UUID,
ADD COLUMN     "exercise_id" UUID,
ADD COLUMN     "left_video" VARCHAR,
ADD COLUMN     "right_video" VARCHAR;
