"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roles = [
  { value: "ALL", label: "All Roles" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "COLLEGE_ADMIN", label: "College Admin" },
  { value: "STUDENT", label: "Student" },
];

export function RoleFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRole = searchParams.get("role") || "ALL";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete("role");
    } else {
      params.set("role", value);
    }
    router.push(`/admin/users?${params.toString()}`);
  }

  return (
    <Select value={currentRole} onValueChange={handleChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Filter by role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
