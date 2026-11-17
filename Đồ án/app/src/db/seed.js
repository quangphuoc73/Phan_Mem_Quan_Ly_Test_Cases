// Dữ liệu mẫu cho demo. Chạy: npm run seed   (xóa và tạo lại: npm run reset)
// Requirement mẫu đóng vai trò dữ liệu đã đồng bộ từ Jira (mã dạng KEY-số theo QĐ1).
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { getDb, closeDb } = require('./index');
const config = require('../config');
const ac = require('../utils/ac');

// BM9. Tham số đánh dấu feature chỉ hiện khi bật phần ngoài MVP tương ứng
const PARAMETERS = [
  ['MAX_TC_PER_STORY', '20', 'int', 'QĐ2: Số test case tối đa của mỗi requirement'],
  ['MIN_AC_PER_STORY', '1', 'int', 'QĐ1: Số AC tối thiểu để AI được sinh test case'],
  ['AI_MAX_RETRY', '2', 'int', 'QĐ2: Số lần thử lại khi AI trả kết quả sai định dạng'],
  ['AI_TIMEOUT_SEC', '30', 'int', 'QĐ2: Thời gian chờ tối đa một lần gọi AI (giây)'],
  ['AI_CALLS_PER_HOUR', '30', 'int', 'QĐ2: Số lần gọi AI tối đa của mỗi người dùng trong 1 giờ (YC2, YC15, YC17)'],
  ['RUN_TIMEOUT_SEC', '60', 'int', 'QĐ19 (ngoài MVP): Thời gian tối đa chạy một script tự động (giây)'],
  ['SPRINT_MAX_DAYS', '28', 'int', 'QĐ20 (ngoài MVP): Độ dài tối đa của một sprint (ngày)'],
];

// Mật khẩu mẫu chỉ dùng cho demo – đổi ngay khi triển khai thật
const USERS = [
  ['admin', 'Admin@123', 'Nguyễn Quản Trị', 'admin@demo.local', 'ADMIN'],
  ['qalead', 'QaLead@123', 'Trần Trưởng Nhóm QA', 'qalead@demo.local', 'QA_LEAD'],
  ['poba', 'PoBa@1234', 'Võ Phân Tích', 'poba@demo.local', 'PO_BA'],
  ['tester', 'Tester@123', 'Lê Kiểm Thử', 'tester@demo.local', 'TESTER'],
  ['dev', 'Dev@123456', 'Phạm Lập Trình', 'dev@demo.local', 'DEVELOPER'],
];

function seed() {
  const db = getDb();
  const insParam = db.prepare('INSERT OR IGNORE INTO parameters (key, value, data_type, description) VALUES (?, ?, ?, ?)');
  PARAMETERS.forEach((p) => insParam.run(...p));

  const insUser = db.prepare('INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)');
  const uid = {};
  USERS.forEach(([u, p, n, e, r]) => (uid[r] = Number(insUser.run(u, bcrypt.hashSync(p, 10), n, e, r).lastInsertRowid)));

  const insProject = db.prepare('INSERT INTO projects (code, name, description, base_url, created_by) VALUES (?, ?, ?, ?, ?)');
  const insModule = db.prepare('INSERT INTO modules (project_id, name, description) VALUES (?, ?, ?)');
  const insMember = db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)');
  const insStory = db.prepare(
    `INSERT INTO user_stories (code, project_id, module_id, title, description, acceptance_criteria, priority, jira_status,
       synced_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'To Do', datetime('now','localtime', ?), ?, datetime('now','localtime', ?))`
  );
  const insReqVer = db.prepare(
    `INSERT INTO requirement_versions (story_id, version, title, description, acceptance_criteria, source, created_at)
     VALUES (?, 1, ?, ?, ?, 'SEED', datetime('now','localtime', ?))`
  );
  const insTc = db.prepare(
    `INSERT INTO test_cases (code, story_id, title, precondition, steps, expected_result, priority, type, status, source, version, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)`
  );
  const insTcAc = db.prepare('INSERT INTO test_case_acs (test_case_id, ac_text) VALUES (?, ?)');
  const insVer = db.prepare('INSERT INTO test_case_versions (test_case_id, version, snapshot, change_note, changed_by) VALUES (?, ?, ?, ?, ?)');
  const insReview = db.prepare('INSERT INTO reviews (test_case_id, reviewer_id, decision, note) VALUES (?, ?, ?, ?)');

  const story = (code, project, module, title, desc, criteria, priority, days) => {
    const text = criteria.join('\n');
    const id = Number(insStory.run(code, project, module, title, desc, text, priority, days, uid.PO_BA, days).lastInsertRowid);
    insReqVer.run(id, title, desc, text, days);
    return { id, code, acs: ac.parse(text) };
  };
  const testCase = (s, n, title, pre, steps, exp, pri, type, source, acIdx, editedVersion) => {
    const code = `${s.code}-TC${String(n).padStart(2, '0')}`;
    const version = editedVersion ? 2 : 1;
    const id = Number(insTc.run(code, s.id, title, pre, JSON.stringify(steps), exp, pri, type, source, version, uid.TESTER).lastInsertRowid);
    acIdx.forEach((i) => insTcAc.run(id, s.acs[i]));
    const snap = JSON.stringify({ title, precondition: pre, steps, expected_result: exp, priority: pri, type });
    insVer.run(id, 1, snap, source === 'AI' ? 'Bản gốc do AI sinh' : 'Tạo thủ công', uid.TESTER);
    if (editedVersion) insVer.run(id, 2, snap, 'Sửa dữ liệu biên cho chính xác', uid.TESTER);
    insReview.run(id, uid.QA_LEAD, 'APPROVED', 'Đạt');
    return { id, code, version };
  };

  // ===== Dự án 1: App bảo hiểm thú cưng (hư cấu) =====
  const pet = Number(insProject.run('PETINS', 'App bảo hiểm thú cưng', 'Ứng dụng mua bảo hiểm và yêu cầu bồi thường chi phí thú y cho chó, mèo.', null, uid.ADMIN).lastInsertRowid);
  [uid.QA_LEAD, uid.PO_BA, uid.TESTER, uid.DEVELOPER].forEach((u) => insMember.run(pet, u));
  const mAcc = Number(insModule.run(pet, 'Tài khoản', 'Đăng ký, đăng nhập, hồ sơ').lastInsertRowid);
  const mPol = Number(insModule.run(pet, 'Hợp đồng', 'Mua và gia hạn hợp đồng bảo hiểm').lastInsertRowid);
  const mClaim = Number(insModule.run(pet, 'Bồi thường', 'Gửi và xử lý yêu cầu bồi thường').lastInsertRowid);

  const p1 = story('PETINS-1', pet, mAcc, 'Đăng ký tài khoản chủ thú cưng',
    'Là chủ thú cưng, tôi muốn đăng ký tài khoản bằng email, để mua bảo hiểm và theo dõi hợp đồng.',
    ['Email phải đúng định dạng và chưa được đăng ký', 'Mật khẩu tối thiểu 8 ký tự, có chữ hoa và số',
      'Đăng ký thành công thì gửi email xác nhận', 'Không cho đăng ký nếu chưa đồng ý điều khoản'], 'High', '-20 days');
  story('PETINS-2', pet, mPol, 'Mua hợp đồng bảo hiểm cho thú cưng',
    'Là chủ thú cưng, tôi muốn chọn gói bảo hiểm và thanh toán online, để thú cưng được bảo vệ ngay.',
    ['Bắt buộc khai báo loài, giống, ngày sinh của thú cưng', 'Thú cưng trên 10 tuổi không được mua gói Cơ bản',
      'Thanh toán thành công thì hợp đồng có hiệu lực sau 1 ngày', 'Hiển thị tóm tắt quyền lợi trước khi thanh toán'], 'High', '-18 days');
  story('PETINS-3', pet, mClaim, 'Gửi yêu cầu bồi thường',
    'Là chủ thú cưng, tôi muốn gửi yêu cầu bồi thường kèm hóa đơn thú y, để được hoàn tiền nhanh chóng.',
    ['Tải lên được hóa đơn dạng PDF hoặc ảnh, tối đa 10 MB', 'Bắt buộc chọn thú cưng và ngày khám',
      'Gửi thành công thì hiển thị mã yêu cầu bồi thường', 'Hợp đồng hết hạn thì không cho gửi và báo lỗi'], 'High', '-15 days');
  story('PETINS-4', pet, mClaim, 'Theo dõi trạng thái bồi thường',
    'Là chủ thú cưng, tôi muốn xem trạng thái yêu cầu bồi thường, để biết khi nào được hoàn tiền. Liên hệ hỗ trợ: nguyenvana@gmail.com hoặc 0912345678.',
    ['Hiển thị danh sách yêu cầu theo thời gian mới nhất', 'Mỗi yêu cầu có trạng thái: Đã gửi, Đang xét duyệt, Đã duyệt, Từ chối',
      'Bị từ chối thì hiển thị lý do'], 'Medium', '-12 days');
  story('PETINS-5', pet, mPol, 'Đổi gói bảo hiểm',
    'Là chủ thú cưng, tôi muốn nâng hoặc hạ gói bảo hiểm, để phù hợp nhu cầu và chi phí.', [], 'Low', '-2 days'); // Thiếu AC [A4]

  const petTcs = [
    testCase(p1, 1, 'Đăng ký thành công với email và mật khẩu hợp lệ', 'Chưa đăng nhập',
      ['Mở trang Đăng ký', 'Nhập email "an.nguyen@example.com"', 'Nhập mật khẩu "Matkhau123"', 'Tích đồng ý điều khoản', 'Nhấn Đăng ký'],
      'Tạo tài khoản thành công và gửi email xác nhận', 'High', 'Positive', 'AI', [0, 2]),
    testCase(p1, 2, 'Đăng ký với email đã tồn tại', 'Chưa đăng nhập',
      ['Mở trang Đăng ký', 'Nhập email đã được đăng ký', 'Nhập mật khẩu hợp lệ', 'Nhấn Đăng ký'],
      'Hiển thị lỗi "Email đã được sử dụng"', 'High', 'Negative', 'AI', [0]),
    testCase(p1, 3, 'Mật khẩu 7 ký tự (dưới ngưỡng tối thiểu)', 'Chưa đăng nhập',
      ['Mở trang Đăng ký', 'Nhập email hợp lệ', 'Nhập mật khẩu "Abc1234"', 'Nhấn Đăng ký'],
      'Hiển thị lỗi mật khẩu tối thiểu 8 ký tự', 'Medium', 'Edge', 'AI', [1], true),
    testCase(p1, 4, 'Không đồng ý điều khoản', 'Chưa đăng nhập',
      ['Mở trang Đăng ký', 'Nhập email và mật khẩu hợp lệ', 'Bỏ tích đồng ý điều khoản', 'Nhấn Đăng ký'],
      'Nút Đăng ký bị vô hiệu hoặc báo lỗi phải đồng ý điều khoản', 'Medium', 'Negative', 'MANUAL', [3]),
  ];

  // ===== Dự án 2: Sauce Demo (web công khai để luyện kiểm thử) =====
  const sauce = Number(insProject.run('SAUCE', 'Sauce Demo Shop', 'Trang bán hàng mẫu công khai dành cho luyện kiểm thử.', 'https://www.saucedemo.com/', uid.ADMIN).lastInsertRowid);
  [uid.QA_LEAD, uid.TESTER, uid.DEVELOPER].forEach((u) => insMember.run(sauce, u));
  const mLogin = Number(insModule.run(sauce, 'Đăng nhập', null).lastInsertRowid);
  const mCart = Number(insModule.run(sauce, 'Giỏ hàng', null).lastInsertRowid);
  const s1 = story('SAUCE-1', sauce, mLogin, 'Đăng nhập vào cửa hàng',
    'Là khách hàng, tôi muốn đăng nhập bằng username và mật khẩu, để mua sắm.',
    ['Đăng nhập đúng thì chuyển tới trang Products', 'Sai mật khẩu thì hiển thị thông báo lỗi', 'Tài khoản bị khóa thì không cho đăng nhập'],
    'High', '-6 days');
  const s2 = story('SAUCE-2', sauce, mCart, 'Thêm sản phẩm vào giỏ hàng',
    'Là khách hàng, tôi muốn thêm sản phẩm vào giỏ, để thanh toán một lần.',
    ['Nhấn Add to cart thì biểu tượng giỏ hàng tăng số lượng', 'Giỏ hàng hiển thị đúng sản phẩm đã chọn'], 'Medium', '-6 days');
  const login = ['Mở trang đăng nhập', 'Nhập tên đăng nhập "standard_user"', 'Nhập mật khẩu "secret_sauce"', 'Nhấn nút Login'];
  const sauceTcs = [
    testCase(s1, 1, 'Đăng nhập thành công với tài khoản chuẩn', 'Có kết nối Internet', login, 'Chuyển tới trang Products', 'High', 'Positive', 'MANUAL', [0]),
    testCase(s1, 2, 'Đăng nhập sai mật khẩu', 'Có kết nối Internet',
      ['Mở trang đăng nhập', 'Nhập tên đăng nhập "standard_user"', 'Nhập mật khẩu "wrong_password"', 'Nhấn nút Login'],
      'Hiển thị thông báo lỗi "Username and password do not match"', 'High', 'Negative', 'MANUAL', [1]),
    testCase(s1, 3, 'Đăng nhập bằng tài khoản bị khóa', 'Có kết nối Internet',
      ['Mở trang đăng nhập', 'Nhập tên đăng nhập "locked_out_user"', 'Nhập mật khẩu "secret_sauce"', 'Nhấn nút Login'],
      'Hiển thị thông báo lỗi "Sorry, this user has been locked out"', 'High', 'Negative', 'MANUAL', [2]),
    testCase(s2, 1, 'Thêm 1 sản phẩm vào giỏ hàng', 'Có kết nối Internet', [...login, 'Thêm "Sauce Labs Backpack" vào giỏ hàng'],
      'Biểu tượng giỏ hàng hiển thị số 1', 'Medium', 'Positive', 'MANUAL', [0, 1]),
  ];

  // ===== YC13: Test Suite =====
  const insSuite = db.prepare('INSERT INTO test_suites (project_id, name, description, created_by) VALUES (?, ?, ?, ?)');
  const insSuiteItem = db.prepare('INSERT INTO test_suite_items (suite_id, test_case_id) VALUES (?, ?)');
  const suitePet = Number(insSuite.run(pet, 'Đăng ký tài khoản', 'Kiểm thử chức năng đăng ký', uid.QA_LEAD).lastInsertRowid);
  petTcs.forEach((t) => insSuiteItem.run(suitePet, t.id));
  const suiteSauce = Number(insSuite.run(sauce, 'Smoke test cửa hàng', 'Đăng nhập và giỏ hàng', uid.QA_LEAD).lastInsertRowid);
  sauceTcs.forEach((t) => insSuiteItem.run(suiteSauce, t.id));

  // ===== YC14, YC5, YC18: Test Run, kết quả, báo sửa lỗi và kiểm thử lại =====
  const insRun = db.prepare(
    `INSERT INTO test_runs (project_id, name, run_type, build, environment, due_date, status, created_by, created_at, closed_by, closed_at)
     VALUES (?, ?, ?, ?, ?, date('now','localtime', ?), ?, ?, datetime('now','localtime', ?), ?, ?)`
  );
  const insItem = db.prepare('INSERT INTO test_run_items (run_id, test_case_id, tc_version, assignee_id) VALUES (?, ?, ?, ?)');
  const insExec = db.prepare(
    `INSERT INTO test_executions (run_id, item_id, test_case_id, tc_version, result, note, defect_code, retest_of, executed_by, executed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime', ?))`
  );
  const closedAt = (d) => db.prepare("SELECT datetime('now','localtime', ?) t").get(d).t;

  const run1 = Number(insRun.run(pet, 'Đăng ký – build 1.0.0', 'NORMAL', '1.0.0', 'Staging', '-8 days', 'CLOSED', uid.QA_LEAD, '-12 days', uid.QA_LEAD, closedAt('-9 days')).lastInsertRowid);
  let failExec = null;
  petTcs.forEach((t, i) => {
    const item = Number(insItem.run(run1, t.id, t.version, uid.TESTER).lastInsertRowid);
    const fail = i === 2;
    const e = Number(insExec.run(run1, item, t.id, t.version, fail ? 'FAIL' : 'PASS',
      fail ? 'Hệ thống chấp nhận mật khẩu 7 ký tự' : null, fail ? 'PETINS-12' : null, null, uid.TESTER, '-10 days').lastInsertRowid);
    if (fail) failExec = { id: e, tc: t };
  });
  const fix = Number(db.prepare(
    `INSERT INTO fix_reports (execution_id, build, note, reported_by, reported_at, status)
     VALUES (?, '1.0.1', 'Thêm kiểm tra độ dài mật khẩu ở backend', ?, datetime('now','localtime','-7 days'), 'WAITING')`
  ).run(failExec.id, uid.DEVELOPER).lastInsertRowid);
  const run2 = Number(insRun.run(pet, 'Kiểm thử lại – build 1.0.1', 'RETEST', '1.0.1', 'Staging', '-4 days', 'CLOSED', uid.QA_LEAD, '-6 days', uid.QA_LEAD, closedAt('-4 days')).lastInsertRowid);
  const item2 = Number(insItem.run(run2, failExec.tc.id, failExec.tc.version, uid.TESTER).lastInsertRowid);
  const retest = Number(insExec.run(run2, item2, failExec.tc.id, failExec.tc.version, 'PASS', 'Kiểm thử lại trên bản 1.0.1', null, failExec.id, uid.TESTER, '-5 days').lastInsertRowid);
  db.prepare("UPDATE fix_reports SET status = 'CLOSED', last_execution_id = ? WHERE id = ?").run(retest, fix);

  const run3 = Number(insRun.run(sauce, 'Smoke test – bản web 11/2026', 'NORMAL', 'web-2026.11', 'Production (saucedemo.com)', '+5 days', 'OPEN', uid.QA_LEAD, '-1 days', null, null).lastInsertRowid);
  sauceTcs.forEach((t, i) => {
    const item = Number(insItem.run(run3, t.id, t.version, i < 2 ? uid.TESTER : uid.QA_LEAD).lastInsertRowid);
    if (i === 0) insExec.run(run3, item, t.id, t.version, 'PASS', null, null, null, uid.TESTER, '-1 hours');
  });

  // ===== YC20 (ngoài MVP): sprint mẫu, chỉ hiện khi bật SPRINT_ENABLED =====
  const day = (offset) => new Date(Date.now() + offset * 86400000).toLocaleDateString('sv-SE');
  const insSprint = db.prepare('INSERT INTO sprints (project_id, name, goal, start_date, end_date) VALUES (?, ?, ?, ?, ?)');
  const petS1 = insSprint.run(pet, 'Sprint 1', 'Khách hàng đăng ký tài khoản và mua được hợp đồng', day(-14), day(-1)).lastInsertRowid;
  const petS2 = insSprint.run(pet, 'Sprint 2', 'Khách hàng gửi và theo dõi được yêu cầu bồi thường', day(0), day(13)).lastInsertRowid;
  const plan = db.prepare('UPDATE user_stories SET sprint_id = ?, story_points = ? WHERE code = ?');
  [[petS1, 5, 'PETINS-1'], [petS1, 8, 'PETINS-2'], [petS2, 5, 'PETINS-3'], [petS2, 3, 'PETINS-4']].forEach((r) => plan.run(...r));

  db.prepare("INSERT INTO audit_logs (user_id, action, detail) VALUES (?, 'SEED', 'Khởi tạo dữ liệu mẫu')").run(uid.ADMIN);
}

// Bổ sung tham số mới cho CSDL đã tạo từ phiên bản trước
function ensureParameters() {
  const ins = getDb().prepare('INSERT OR IGNORE INTO parameters (key, value, data_type, description) VALUES (?, ?, ?, ?)');
  PARAMETERS.forEach((p) => ins.run(...p));
}

function seedIfEmpty() {
  ensureParameters();
  const { n } = getDb().prepare('SELECT COUNT(*) n FROM users').get();
  if (!n) {
    getDb().transaction(seed)();
    console.log('  Đã tạo dữ liệu mẫu.');
  }
}

if (require.main === module) {
  if (process.argv.includes('--reset') && config.dbFile !== ':memory:') {
    for (const f of [config.dbFile, `${config.dbFile}-wal`, `${config.dbFile}-shm`]) fs.rmSync(f, { force: true });
  }
  seedIfEmpty();
  closeDb();
  console.log('  Xong. Tài khoản demo: admin/Admin@123, qalead/QaLead@123, poba/PoBa@1234, tester/Tester@123, dev/Dev@123456');
}

module.exports = { seed, seedIfEmpty, PARAMETERS, USERS };
