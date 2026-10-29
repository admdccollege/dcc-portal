import type { FieldConfig } from "@/components/shared/record-dialog";

export function staffFields(departments: { id: string; name: string }[], confidential: boolean): FieldConfig[] {
  return [
    { name: "full_name", label: "Full name", required: true, full: true },
    { name: "employee_id", label: "Employee ID", required: true },
    { name: "designation", label: "Designation", required: true },
    { name: "department_id", label: "Department", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) },
    { name: "status", label: "Status", type: "select", required: true, options: [{ value: "active", label: "Active" }, { value: "on_leave", label: "On leave" }, { value: "resigned", label: "Resigned" }, { value: "retired", label: "Retired" }] },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone" },
    { name: "date_of_joining", label: "Date of joining", type: "date" },
    { name: "is_teaching", label: "Teaching staff", type: "checkbox" },
    ...(confidential ? ([
      { name: "date_of_birth", label: "Date of birth (confidential)", type: "date" },
      { name: "qualification", label: "Qualification (confidential)" },
      { name: "address", label: "Address (confidential)", type: "textarea", full: true },
    ] as FieldConfig[]) : []),
  ];
}
