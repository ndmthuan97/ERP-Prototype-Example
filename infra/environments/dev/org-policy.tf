# ============================================================
# Org Policy override — REMOVED
# ============================================================
# Trước đây file này tạo google_org_policy_policy.allow_public_member_domains để
# override Domain Restricted Sharing (constraint iam.allowedPolicyMemberDomains)
# cho phép allUsers trên các service is_public (api-gateway, frontend).
#
# Thực tế project portfolio-497506 (project cá nhân) KHÔNG enforce DRS: gateway &
# frontend đã public và chạy được mà không cần override này (binding allUsers đã
# tồn tại trong state). Ngược lại, resource org-policy gây fail `terraform apply`:
#   - orgpolicy.googleapis.com đòi ADC quota project (403), và
#   - roles/orgpolicy.policyAdmin không gán được ở cấp project (400).
# Vì mọi is_public service depends_on nó, cả apply bị chặn → ingress/invoker bị bỏ.
#
# ⇒ Đã gỡ: resource org-policy (file này), role orgpolicy.policyAdmin của deployer
#   (modules/iam/main.tf), và depends_on tương ứng trong main.tf (module cloud_run).
#
# Nếu sau này chuyển sang org CÓ enforce DRS, khôi phục lại resource này + cấp
# roles/orgpolicy.policyAdmin ở cấp org cho identity chạy apply.
# ============================================================
