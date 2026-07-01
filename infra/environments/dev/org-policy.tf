# ============================================================
# Org Policy override — cho phép public (allUsers) invoker
# ============================================================
# Domain Restricted Sharing (constraint iam.allowedPolicyMemberDomains) mặc định
# CHẶN allUsers / allAuthenticatedUsers. Vì vậy Cloud Run --allow-unauthenticated
# (các service is_public = true: api-gateway, frontend) bị từ chối IAM binding
# → đúng lỗi "Setting IAM policy failed ... allUsers" khi deploy.
#
# Resource dưới override constraint ở cấp PROJECT để cho phép mọi member,
# nhờ đó binding allUsers (trong module cloud-run) mới apply được.
#
# ------------------------------------------------------------
# ⚠️ 1. BẢO MẬT: allow_all = "TRUE" nới Domain Restricted Sharing cho TOÀN BỘ
#    project portfolio-497506 — mọi resource (không chỉ gateway) có thể được
#    chia sẻ ra ngoài domain, gồm allUsers. Chỉ apply nếu chấp nhận rủi ro này.
#    (DRS là constraint cấp project/folder/org, không thể giới hạn theo từng
#    service; muốn hẹp hơn thì đặt gateway sau Cloud IAP thay vì mở allUsers.)
#
# ⚠️ 2. QUYỀN: apply cần identity có roles/orgpolicy.policyAdmin ở cấp project
#    (hoặc org/folder). Nếu tổ chức KHÓA override ở cấp org, project không tự
#    ghi đè được → phải nhờ GCP org-admin. WIF DEPLOYER_SA hiện nhiều khả năng
#    KHÔNG có quyền này.
#
# ⚠️ 3. PROPAGATION: thay đổi org policy có độ trễ (tới ~vài phút). Nếu lần
#    `terraform apply` đầu vẫn báo binding allUsers fail, chờ ~2–5 phút rồi
#    `terraform apply` lại — resource org policy đã tạo, binding sẽ qua.
# ============================================================

resource "google_org_policy_policy" "allow_public_member_domains" {
  name   = "projects/${var.project_id}/policies/iam.allowedPolicyMemberDomains"
  parent = "projects/${var.project_id}"

  spec {
    rules {
      allow_all = "TRUE"
    }
  }

  # Cần Org Policy API bật trước.
  depends_on = [google_project_service.apis]
}
