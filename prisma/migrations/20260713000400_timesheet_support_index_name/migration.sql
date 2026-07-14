-- PostgreSQL truncates identifiers longer than 63 bytes. Give the
-- allocation-support uniqueness constraint a stable Prisma-aligned name.
ALTER INDEX "WorkAllocationSupportPerson_workAllocationId_supportPersonId_ke"
RENAME TO "WorkAllocationSupportPerson_allocation_person_key";
