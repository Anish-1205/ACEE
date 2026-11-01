-- Document categories now follow the Telangana ePASS overseas-scholarship upload list.
-- Data-only migration: map the old category codes onto the new ones.
UPDATE "Document" SET "category" = 'CASTE_CERTIFICATE' WHERE "category" = 'COMMUNITY_CERTIFICATE';
UPDATE "Document" SET "category" = 'MARKS_MEMO' WHERE "category" = 'GRADUATION_MARKSHEET';
UPDATE "Document" SET "category" = 'OTHER' WHERE "category" = 'EDUCATION_CERTIFICATE';
