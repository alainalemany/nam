import { prisma } from "@/lib/prisma";

export function getEmployees() {
  return prisma.employee.findMany({
    orderBy: [
      { isActive: "desc" },
      { displayName: "asc" },
      { employeeCode: "asc" },
      { id: "asc" },
    ],
  });
}

export function getEmployee(id: string) {
  return prisma.employee.findUnique({ where: { id } });
}
