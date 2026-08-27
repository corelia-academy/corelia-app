# Quy trình release Corelia

Tài liệu này là phần hướng dẫn vận hành đi kèm README gốc. Nội dung mô tả mô hình kiểm soát release của `corelia-app`; các file workflow vẫn là nguồn thực thi chính xác.

## Phạm vi

Quy trình này tách việc phát hành frontend khỏi các thay đổi Supabase, kiểm tra thay đổi database trước khi ghi vào môi trường remote và yêu cầu artifact được approve rõ ràng khi release Production. Phạm vi gồm kiểm tra Pull Request, deploy Staging, kiểm soát release Production và xử lý failure.

Tài liệu này không mô tả hành vi của từng feature trong app. Các kiểm tra theo feature đặt tại test hoặc tài liệu QA tương ứng.

## Kiến trúc release

| Khu vực | Trigger | Trách nhiệm | Ranh giới |
| --- | --- | --- | --- |
| Database pull-request guardrails | Pull Request chạm vào database hoặc các path kiểm soát release | Kiểm tra migration declaration, frozen baseline, drift và local migration recreation | Không ghi vào các môi trường được bảo vệ |
| Staging backend release | Push vào `staging` khi khớp path filter, hoặc manual dispatch | Verify repository, apply Supabase migrations và deploy Edge Functions | Không publish frontend Vite/Cloudflare Workers |
| Production control-plane bootstrap | Thay đổi control-plane đã được approve trên `main` | Đưa workflow Production và các lớp kiểm tra lên branch được bảo vệ | Không phải application hoặc database release |
| Production application release | Manual dispatch từ `main` với release SHA đã approve | Verify artifact, apply migrations, deploy Edge Functions và chạy live-state gates | Không thay thế pipeline publish frontend riêng |
| Frontend publication | Pipeline frontend riêng | Publish Vite build lên Cloudflare Workers khi đủ điều kiện release | Không apply Supabase migrations |

## Vì sao có các ranh giới này

- **Tách deployment path:** Thay đổi database và Edge Function có thể cần cách validate và rollback khác với frontend. Tách workflow tránh việc một backend release kéo theo frontend publication không liên quan.
- **Guardrails ở Pull Request:** Thay đổi database có thể ảnh hưởng migration history dùng chung ngay cả khi app vẫn build thành công. Các kiểm tra baseline, declaration và isolated recreation giúp schema change được khai báo rõ trước khi đi vào môi trường được bảo vệ.
- **Pre-deploy verification:** Nếu migration chỉ fail sau khi đã ghi vào project được link, việc khắc phục có thể phải dùng forward fix. Recreate migration chain ở local và chạy application checks trước giúp phát hiện failure trong môi trường có thể tạo lại.
- **Production release hai giai đoạn:** Các control của Production phải tồn tại trước khi release mà chúng bảo vệ được phép ghi vào Production. Tách control-plane bootstrap khỏi application release giúp thứ tự này được kiểm soát rõ.
- **Định danh release được bảo vệ:** Một branch merge chỉ cho biết lịch sử code, chưa tự xác định artifact Production đã được review. Approved commit SHA và release manifest giúp xác định chính xác target để audit.
- **Kiểm tra trạng thái live:** Migration files mô tả trạng thái dự kiến nhưng không chứng minh trạng thái thật của remote project. Read-only history check cùng pre- và post-deployment database check giúp phát hiện drift mà không tạo thêm write path.
- **Kiểm soát failure:** Deployment chồng lấn và local cleanup không có giới hạn có thể làm kết quả CI không rõ ràng. Concurrency control và cleanup có giới hạn giúp failure được quan sát đúng nguyên nhân.

## Kiểm tra Pull Request

Các thay đổi database và release-control được kiểm tra bởi [`Database Guardrails`](../.github/workflows/db-guardrails.yml). Workflow kiểm tra frozen migration baseline, drift allowlist, database-change declaration và việc recreate local migration chain từ đầu.

PR template ghi nhận database change có cần migration hay không, validation evidence và deployment notes. Direct SQL là ngoại lệ; [emergency database SQL template](../.github/ISSUE_TEMPLATE/emergency-db-sql.yml) yêu cầu một forward-only reconciliation migration.

## Release Staging

Workflow [`Deploy Staging`](../.github/workflows/deploy-staging.yml) chỉ áp dụng cho branch `staging`. Push chỉ trigger workflow khi path thay đổi khớp filter; workflow cũng có thể được chạy thủ công bằng `workflow_dispatch`.

Job `verify` phải pass trước khi job `deploy` được chạy. Job này cài dependency theo lockfile và Supabase CLI theo version đã pin, sau đó chạy:

- migration governance checks;
- full application test suite;
- lint và staging build; và
- clean local migration-chain recreation.

Sau khi verify, job `deploy` apply migrations vào Staging project được link và deploy các Edge Functions đã cấu hình. Khi rollout có destructive migration, backend tương thích phải được deploy theo thứ tự release đã định trước khi migration được apply. Workflow không publish frontend Vite/Cloudflare Workers. Dùng [Staging bundle verification](STAGING_BUILD_VERIFY.md) khi cần kiểm tra frontend và backend cùng nhau.

## Release Production

Production không tự trigger theo push. Merge `staging` vào `main` không tự chạy [`Deploy Production`](../.github/workflows/deploy-prod.yml).

### Giai đoạn A: control-plane bootstrap

Control-plane bootstrap đưa Production workflow, artifact checks, migration-state checks và post-deployment gates lên branch `main` được bảo vệ. Giai đoạn này đưa các control vào vị trí sẵn sàng trước application release mà chúng bảo vệ.

### Giai đoạn B: application release đã approve

Production workflow được manual dispatch từ `main` và yêu cầu:

- `release_sha`: full SHA của release commit đã approve, không phải PR number hoặc branch name;
- `confirmation`: giá trị chính xác đang được workflow định nghĩa, hiện là `DEPLOY_R5_DB_EDGE_TO_PRODUCTION`; và
- `recovery_limitations_accepted`: xác nhận rõ rằng khả năng backup và rollback đang có các giới hạn đã biết.

Trước khi ghi vào Production, workflow kiểm tra release identity và manifest đã approve, chạy migration governance, test, lint, Production frontend artifact build và local migration recreation. Job deploy sau đó:

1. kiểm tra pre-migration state dự kiến;
2. apply các migration đã approve;
3. kiểm tra live database invariants trước khi deploy Edge;
4. deploy các Edge Functions cần thiết; và
5. chạy post-Edge runtime và database check cuối cùng.

Frontend artifact được verify trong Production gate, nhưng việc publish lên Cloudflare Workers vẫn thuộc deployment path riêng.

Recovery checkbox là risk acknowledgement, không phải bằng chứng recovery đã được rehearsal. Workflow hiện ghi nhận các giới hạn gồm PITR không khả dụng, restore chưa rehearsal, RPO/RTO chưa được đo, forward-fix là chiến lược recovery chính cho migration và Edge/frontend rollback có thể chưa rehearsal.

## Kiểm tra migration history trên môi trường live

[`Verify Protected Live Migration History`](../.github/workflows/db-live-history-verify.yml) là workflow manual, read-only cho `staging` hoặc `main`. Workflow export migration ledger của target qua kết nối PostgreSQL least-privilege, kiểm tra project identity và history dự kiến, rồi upload kết quả thành artifact.

Quy tắc migration baseline, catalog fingerprint và deployment discipline được mô tả trong [`docs/db-baseline/README.md`](db-baseline/README.md).

## Xử lý failure

- Verification gate fail sẽ chặn job deploy; không bypass gate hoặc thay bằng release SHA khác.
- Staging run fail phải được điều tra tại check bị fail và sửa trên source branch trước khi chạy lại.
- Nếu Production đã bắt đầu ghi dữ liệu, không xem đó là một lần retry thông thường. Giữ lại workflow evidence, kiểm tra migration và database state bằng read-only, sau đó áp dụng forward-only reconciliation hoặc incident process khi cần.
- Cleanup timeout hoặc process failure không chứng minh remote deployment đã thành công. Cần xác nhận remote state qua read-only check hoặc post-deployment gate phù hợp.

## Evidence cần có để approve release

Trước khi approve Production release, reviewer cần xác định được:

- source branch và `release_sha` chính xác đã approve;
- release manifest tương ứng;
- evidence Staging verification và deployment thành công;
- migration state dự kiến và live-history verification artifact nếu có;
- kết quả Production pre-migration, post-migration và post-Edge gates; và
- evidence build/publication frontend riêng nếu release có thay đổi frontend.

Các rollout plan và execution report lịch sử trong `docs/db-baseline/` chỉ cung cấp context và evidence cho từng release cụ thể. Chúng không thay thế workflow hiện tại hoặc một release candidate đã được refresh.
