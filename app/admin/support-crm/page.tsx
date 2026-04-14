import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminSupportCrmPage() {
  return (
    <AdminModulePage
      title="Support CRM"
      description="Track customer conversations, escalation status, and service outcomes."
      bullets={[
        "Inbox workflow by ticket status.",
        "Conversation history per customer.",
        "Response templates and SLA checkpoints.",
      ]}
    />
  );
}
