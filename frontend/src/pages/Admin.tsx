import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { apiFetch, ApiError } from "../lib/api";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import type { User, AuditLog } from "../types/report.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ROLE_COLOURS: Record<
  string,
  "green" | "yellow" | "red" | "blue" | "default"
> = {
  admin: "blue",
  approved: "green",
  pending: "yellow",
  rejected: "red",
};

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users", roleFilter],
    queryFn: async () => {
      const qs = roleFilter ? `?role=${roleFilter}` : "";
      const res = await apiFetch(`/api/v1/admin/users${qs}`);
      return ((await res.json()) as { data: User[] }).data;
    },
    staleTime: 30_000,
  });

  const { mutate: updateRole, isPending } = useMutation({
    mutationFn: async ({
      id,
      role,
    }: {
      id: string;
      role: "approved" | "rejected";
    }) => {
      await apiFetch(`/api/v1/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "pending-count"],
      });
    },
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label
          className="text-sm font-medium text-cream-muted"
          htmlFor="role-filter"
        >
          Filter by role:
        </label>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded border border-navy-700 bg-navy-800 text-cream px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/50"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !users || users.length === 0 ? (
        <p className="text-sm text-cream-subtle">No users found.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full divide-y divide-navy-700 text-sm">
            <thead className="bg-navy-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-cream-subtle uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-cream-subtle uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-cream-subtle uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-cream-subtle uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-navy-900 divide-y divide-navy-700/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-navy-800 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-cream truncate max-w-48">
                      {u.display_name ?? u.email}
                    </div>
                    <div className="text-xs text-cream-subtle truncate">
                      {u.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_COLOURS[u.role] ?? "default"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-cream-subtle whitespace-nowrap">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {u.role !== "approved" && u.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="primary"
                          isLoading={isPending}
                          onClick={() =>
                            updateRole({ id: u.id, role: "approved" })
                          }
                        >
                          Approve
                        </Button>
                      )}
                      {u.role !== "rejected" && u.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="danger"
                          isLoading={isPending}
                          onClick={() =>
                            updateRole({ id: u.id, role: "rejected" })
                          }
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

interface AuditFilters {
  ticker: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  page: number;
}

function AuditTab() {
  const [filters, setFilters] = useState<AuditFilters>({
    ticker: "",
    action: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
  });

  const buildQs = (f: AuditFilters): string => {
    const params = new URLSearchParams();
    if (f.ticker) params.set("ticker", f.ticker);
    if (f.action) params.set("action", f.action);
    if (f.dateFrom) params.set("date_from", f.dateFrom);
    if (f.dateTo) params.set("date_to", f.dateTo);
    params.set("page", String(f.page));
    params.set("limit", "50");
    return params.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit", filters],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/audit?${buildQs(filters)}`);
      return (await res.json()) as {
        data: AuditLog[];
        count: number;
        page: number;
        limit: number;
      };
    },
    staleTime: 30_000,
  });

  const handleExportCsv = () => {
    if (!data?.data.length) return;
    const headers = [
      "timestamp",
      "action",
      "ticker",
      "user_id",
      "ip",
      "user_agent",
    ];
    const rows = data.data.map((r) =>
      [
        r.created_at,
        r.action,
        r.ticker_symbol ?? "",
        r.user_id ?? "",
        r.ip_address ?? "",
        (r.user_agent ?? "").replace(/,/g, " "),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = data ? Math.ceil(data.count / 50) : 1;

  return (
    <div>
      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <input
          type="text"
          placeholder="Ticker"
          value={filters.ticker}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              ticker: e.target.value.toUpperCase(),
              page: 1,
            }))
          }
          className="rounded border border-navy-700 bg-navy-800 text-cream px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple/50"
        />
        <select
          value={filters.action}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: e.target.value, page: 1 }))
          }
          className="rounded border border-navy-700 bg-navy-800 text-cream px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/50"
        >
          <option value="">All actions</option>
          <option value="research_triggered">research_triggered</option>
          <option value="research_updated">research_updated</option>
          <option value="report_viewed">report_viewed</option>
          <option value="user_approved">user_approved</option>
          <option value="user_rejected">user_rejected</option>
          <option value="login">login</option>
          <option value="logout">logout</option>
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) =>
            setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))
          }
          className="rounded border border-navy-700 bg-navy-800 text-cream px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/50"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) =>
            setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))
          }
          className="rounded border border-navy-700 bg-navy-800 text-cream px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/50"
        />
      </div>

      <div className="flex justify-between items-center mb-3">
        {data && (
          <p className="text-sm text-cream-subtle">
            {data.count} total records
          </p>
        )}
        <Button size="sm" variant="secondary" onClick={handleExportCsv}>
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full divide-y divide-navy-700 text-sm">
            <thead className="bg-navy-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-cream-subtle uppercase tracking-wider whitespace-nowrap">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-cream-subtle uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-cream-subtle uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-cream-subtle uppercase tracking-wider">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="bg-navy-900 divide-y divide-navy-700/50">
              {data?.data.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-navy-800 transition-colors"
                >
                  <td className="px-4 py-3 text-cream-subtle whitespace-nowrap text-xs">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="default">{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-cream-muted">
                    {log.ticker_symbol ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-cream-subtle text-xs font-mono">
                    {log.ip_address ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            size="sm"
            variant="secondary"
            disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
          >
            Previous
          </Button>
          <span className="text-sm text-cream-subtle">
            Page {filters.page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

type Tab = "users" | "audit";

export default function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-cream mb-6">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-navy-700">
        {(["users", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors",
              tab === t
                ? "border-purple text-purple"
                : "border-transparent text-cream-subtle hover:text-cream",
            ].join(" ")}
          >
            {t === "users" ? "User Management" : "Audit Log"}
          </button>
        ))}
      </div>

      {tab === "users" ? <UsersTab /> : <AuditTab />}
    </div>
  );
}

// Re-export ApiError to satisfy TS unused-import checks indirectly
export type { ApiError };
