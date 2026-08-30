-- Drop faculty relation from Department
ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_facultyId_fkey";

-- Drop the unique constraint on [facultyId, name]
DROP INDEX IF EXISTS "Department_facultyId_name_key";

-- Drop the facultyId column
ALTER TABLE "Department" DROP COLUMN IF EXISTS "facultyId";

-- Drop the Faculty table
DROP TABLE IF EXISTS "Faculty";
