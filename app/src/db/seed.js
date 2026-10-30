// Dữ liệu mẫu cho demo. Chạy: npm run seed   (xóa và tạo lại: npm run reset)
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { getDb, closeDb } = require('./index');
const config = require('../config');

const PARAMETERS = [
  ['MAX_TC_PER_STORY', '20', 'int', 'QĐ2: Số test case tối đa cho mỗi user story'],
  ['MIN_AC_PER_STORY', '1', 'int', 'QĐ1: Số acceptance criteria tối thiểu của user story'],
  ['PRIORITIES', 'High,Medium,Low', 'list', 'QĐ1: Danh sách độ ưu tiên hợp lệ'],
  ['AI_MAX_RETRY', '2', 'int', 'Số lần thử lại khi AI trả kết quả sai định dạng'],
  ['AI_TIMEOUT_SEC', '30', 'int', 'Thời gian chờ tối đa một lần gọi AI (giây)'],
  ['AI_CALLS_PER_HOUR', '30', 'int', 'Số lần gọi AI tối đa của mỗi người dùng trong 1 giờ'],
  ['RUN_TIMEOUT_SEC', '60', 'int', 'QĐ9: Thời gian tối đa chạy một script tự động (giây)'],
  ['SPRINT_MAX_DAYS', '28', 'int', 'QĐ12: Độ dài tối đa của một sprint (ngày)'],
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
  USERS.forEach(([u, p, n, e, r]) => (uid[r] = insUser.run(u, bcrypt.hashSync(p, 10), n, e, r).lastInsertRowid));

  const insProject = db.prepare('INSERT INTO projects (code, name, description, base_url, created_by) VALUES (?, ?, ?, ?, ?)');
  const insModule = db.prepare('INSERT INTO modules (project_id, name, description) VALUES (?, ?, ?)');
  const insStory = db.prepare(
    `INSERT INTO user_stories (code, project_id, module_id, title, description, acceptance_criteria, priority, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime', ?))`
  );
  const insTc = db.prepare(
    `INSERT INTO test_cases (code, story_id, title, precondition, steps, expected_result, priority, type, status, source, version, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insVer = db.prepare('INSERT INTO test_case_versions (test_case_id, version, snapshot, change_note, changed_by) VALUES (?, ?, ?, ?, ?)');
  const insReview = db.prepare('INSERT INTO reviews (test_case_id, reviewer_id, decision, note) VALUES (?, ?, ?, ?)');
  const insRun = db.prepare(
    `INSERT INTO test_runs (test_case_id, result, run_type, note, executed_by, executed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now','localtime', ?))`
  );

  // ===== Dự án 1: App bảo hiểm thú cưng (hư cấu) =====
  const pet = insProject.run('PETINS', 'App bảo hiểm thú cưng', 'Ứng dụng mua bảo hiểm và yêu cầu bồi thường chi phí thú y cho chó, mèo.', null, uid.ADMIN).lastInsertRowid;
  const mAcc = insModule.run(pet, 'Tài khoản', 'Đăng ký, đăng nhập, hồ sơ').lastInsertRowid;
  const mPol = insModule.run(pet, 'Hợp đồng', 'Mua và gia hạn hợp đồng bảo hiểm').lastInsertRowid;
  const mClaim = insModule.run(pet, 'Bồi thường', 'Gửi và xử lý yêu cầu bồi thường').lastInsertRowid;

  const s1 = insStory.run('US-PET-001', pet, mAcc, 'Đăng ký tài khoản chủ thú cưng',
    'Là chủ thú cưng, tôi muốn đăng ký tài khoản bằng email, để mua bảo hiểm và theo dõi hợp đồng.',
    '- Email phải đúng định dạng và chưa được đăng ký\n- Mật khẩu tối thiểu 8 ký tự, có chữ hoa và số\n- Đăng ký thành công thì gửi email xác nhận\n- Không cho đăng ký nếu chưa đồng ý điều khoản',
    'High', uid.PO_BA, '-6 days').lastInsertRowid;
  insStory.run('US-PET-002', pet, mPol, 'Mua hợp đồng bảo hiểm cho thú cưng',
    'Là chủ thú cưng, tôi muốn chọn gói bảo hiểm và thanh toán online, để thú cưng được bảo vệ ngay.',
    '- Bắt buộc khai báo loài, giống, ngày sinh của thú cưng\n- Thú cưng trên 10 tuổi không được mua gói Cơ bản\n- Thanh toán thành công thì hợp đồng có hiệu lực sau 1 ngày\n- Hiển thị tóm tắt quyền lợi trước khi thanh toán',
    'High', uid.PO_BA, '-5 days');
  insStory.run('US-PET-003', pet, mClaim, 'Gửi yêu cầu bồi thường',
    'Là chủ thú cưng, tôi muốn gửi yêu cầu bồi thường kèm hóa đơn thú y, để được hoàn tiền nhanh chóng.',
    '- Tải lên được hóa đơn dạng PDF hoặc ảnh, tối đa 10 MB\n- Bắt buộc chọn thú cưng và ngày khám\n- Gửi thành công thì hiển thị mã yêu cầu bồi thường\n- Hợp đồng hết hạn thì không cho gửi và báo lỗi',
    'High', uid.PO_BA, '-4 days');
  insStory.run('US-PET-004', pet, mClaim, 'Theo dõi trạng thái bồi thường',
    'Là chủ thú cưng, tôi muốn xem trạng thái yêu cầu bồi thường, để biết khi nào được hoàn tiền. Liên hệ hỗ trợ: nguyenvana@gmail.com hoặc 0912345678.',
    '- Hiển thị danh sách yêu cầu theo thời gian mới nhất\n- Mỗi yêu cầu có trạng thái: Đã gửi, Đang xét duyệt, Đã duyệt, Từ chối\n- Bị từ chối thì hiển thị lý do',
    'Medium', uid.PO_BA, '-3 days');
  insStory.run('US-PET-005', pet, mPol, 'Đổi gói bảo hiểm',
    'Là chủ thú cưng, tôi muốn nâng hoặc hạ gói bảo hiểm, để phù hợp nhu cầu và chi phí.',
    '- Chỉ đổi gói khi hợp đồng đang hiệu lực\n- Hiển thị chênh lệch phí trước khi xác nhận\n- Gói mới có hiệu lực từ kỳ thanh toán tiếp theo',
    'Low', uid.PO_BA, '-1 days');

  // Test case mẫu đã duyệt cho US-PET-001 (có lịch sử chạy để báo cáo có số liệu)
  const petTcs = [
    ['Đăng ký thành công với email và mật khẩu hợp lệ', ['Mở trang Đăng ký', 'Nhập email "an.nguyen@example.com"', 'Nhập mật khẩu "Matkhau123"', 'Tích đồng ý điều khoản', 'Nhấn Đăng ký'], 'Tạo tài khoản thành công và gửi email xác nhận', 'High', 'Positive', 'PASS'],
    ['Đăng ký với email đã tồn tại', ['Mở trang Đăng ký', 'Nhập email đã được đăng ký', 'Nhập mật khẩu hợp lệ', 'Nhấn Đăng ký'], 'Hiển thị lỗi "Email đã được sử dụng"', 'High', 'Negative', 'PASS'],
    ['Mật khẩu 7 ký tự (dưới ngưỡng tối thiểu)', ['Mở trang Đăng ký', 'Nhập email hợp lệ', 'Nhập mật khẩu "Abc1234"', 'Nhấn Đăng ký'], 'Hiển thị lỗi mật khẩu tối thiểu 8 ký tự', 'Medium', 'Edge', 'FAIL'],
    ['Không đồng ý điều khoản', ['Mở trang Đăng ký', 'Nhập email và mật khẩu hợp lệ', 'Bỏ tích đồng ý điều khoản', 'Nhấn Đăng ký'], 'Nút Đăng ký bị vô hiệu hoặc báo lỗi phải đồng ý điều khoản', 'Medium', 'Negative', 'PASS'],
  ];
  petTcs.forEach(([title, steps, exp, pri, type, result], i) => {
    const tcId = insTc.run(`US-PET-001-TC${String(i + 1).padStart(2, '0')}`, s1, title, 'Chưa đăng nhập', JSON.stringify(steps), exp, pri, type, 'APPROVED', i < 3 ? 'AI' : 'MANUAL', i === 2 ? 2 : 1, uid.TESTER).lastInsertRowid;
    insVer.run(tcId, 1, JSON.stringify({ title, steps, expected_result: exp, priority: pri, type }), i < 3 ? 'Bản gốc do AI sinh' : 'Tạo thủ công', uid.TESTER);
    if (i === 2) insVer.run(tcId, 2, JSON.stringify({ title, steps, expected_result: exp, priority: pri, type }), 'Sửa dữ liệu biên cho chính xác', uid.TESTER);
    insReview.run(tcId, uid.QA_LEAD, 'APPROVED', 'Đạt');
    insRun.run(tcId, result, 'MANUAL', result === 'FAIL' ? 'Hệ thống chấp nhận mật khẩu 7 ký tự – đã báo bug BUG-12' : null, uid.TESTER, '-10 days');
    // Kiểm thử lại (retest) sau khi Developer sửa lỗi → story đạt Definition of Done
    if (result === 'FAIL') insRun.run(tcId, 'PASS', 'MANUAL', 'Kiểm thử lại sau khi sửa BUG-12', uid.TESTER, '-3 days');
  });

  // ===== Dự án 2: Sauce Demo (web thật để chạy Playwright – YC9) =====
  const sauce = insProject.run('SAUCE', 'Sauce Demo Shop', 'Trang bán hàng mẫu công khai dành cho luyện kiểm thử tự động.', 'https://www.saucedemo.com/', uid.ADMIN).lastInsertRowid;
  const mLogin = insModule.run(sauce, 'Đăng nhập', null).lastInsertRowid;
  const mCart = insModule.run(sauce, 'Giỏ hàng', null).lastInsertRowid;
  const sl = insStory.run('US-SAU-001', sauce, mLogin, 'Đăng nhập vào cửa hàng',
    'Là khách hàng, tôi muốn đăng nhập bằng username và mật khẩu, để mua sắm.',
    '- Đăng nhập đúng thì chuyển tới trang Products\n- Sai mật khẩu thì hiển thị thông báo lỗi\n- Tài khoản bị khóa thì không cho đăng nhập',
    'High', uid.PO_BA, '-2 days').lastInsertRowid;
  const sc = insStory.run('US-SAU-002', sauce, mCart, 'Thêm sản phẩm vào giỏ hàng',
    'Là khách hàng, tôi muốn thêm sản phẩm vào giỏ, để thanh toán một lần.',
    '- Nhấn Add to cart thì biểu tượng giỏ hàng tăng số lượng\n- Giỏ hàng hiển thị đúng sản phẩm đã chọn',
    'Medium', uid.PO_BA, '-2 days').lastInsertRowid;

  const sauceTcs = [
    [sl, 'US-SAU-001-TC01', 'Đăng nhập thành công với tài khoản chuẩn', ['Mở trang đăng nhập', 'Nhập tên đăng nhập "standard_user"', 'Nhập mật khẩu "secret_sauce"', 'Nhấn nút Login'], 'Chuyển tới trang Products', 'High', 'Positive'],
    [sl, 'US-SAU-001-TC02', 'Đăng nhập sai mật khẩu', ['Mở trang đăng nhập', 'Nhập tên đăng nhập "standard_user"', 'Nhập mật khẩu "wrong_password"', 'Nhấn nút Login'], 'Hiển thị thông báo lỗi "Username and password do not match"', 'High', 'Negative'],
    [sl, 'US-SAU-001-TC03', 'Đăng nhập bằng tài khoản bị khóa', ['Mở trang đăng nhập', 'Nhập tên đăng nhập "locked_out_user"', 'Nhập mật khẩu "secret_sauce"', 'Nhấn nút Login'], 'Hiển thị thông báo lỗi "Sorry, this user has been locked out"', 'High', 'Negative'],
    [sc, 'US-SAU-002-TC01', 'Thêm 1 sản phẩm vào giỏ hàng', ['Mở trang đăng nhập', 'Nhập tên đăng nhập "standard_user"', 'Nhập mật khẩu "secret_sauce"', 'Nhấn nút Login', 'Thêm "Sauce Labs Backpack" vào giỏ hàng'], 'Biểu tượng giỏ hàng hiển thị số 1', 'Medium', 'Positive'],
  ];
  sauceTcs.forEach(([story, code, title, steps, exp, pri, type]) => {
    const tcId = insTc.run(code, story, title, 'Có kết nối Internet', JSON.stringify(steps), exp, pri, type, 'APPROVED', 'MANUAL', 1, uid.TESTER).lastInsertRowid;
    insVer.run(tcId, 1, JSON.stringify({ title, steps, expected_result: exp, priority: pri, type }), 'Tạo thủ công', uid.TESTER);
    insReview.run(tcId, uid.QA_LEAD, 'APPROVED', 'Đạt, sẵn sàng tự động hóa');
  });

  // ===== Sprint (Agile/Scrum): ngày tính theo thời điểm tạo dữ liệu mẫu =====
  const day = (offset) => new Date(Date.now() + offset * 86400000).toLocaleDateString('sv-SE');
  const insSprint = db.prepare('INSERT INTO sprints (project_id, name, goal, start_date, end_date) VALUES (?, ?, ?, ?, ?)');
  const petS1 = insSprint.run(pet, 'Sprint 1', 'Khách hàng đăng ký tài khoản và mua được hợp đồng', day(-14), day(-1)).lastInsertRowid;
  const petS2 = insSprint.run(pet, 'Sprint 2', 'Khách hàng gửi và theo dõi được yêu cầu bồi thường', day(0), day(13)).lastInsertRowid;
  const sauS1 = insSprint.run(sauce, 'Sprint 1', 'Tự động hóa kiểm thử đăng nhập và giỏ hàng', day(-6), day(7)).lastInsertRowid;
  const plan = db.prepare('UPDATE user_stories SET sprint_id = ?, story_points = ? WHERE code = ?');
  [
    [petS1, 5, 'US-PET-001'], [petS1, 8, 'US-PET-002'],
    [petS2, 5, 'US-PET-003'], [petS2, 3, 'US-PET-004'],
    [sauS1, 3, 'US-SAU-001'], [sauS1, 2, 'US-SAU-002'],
    [null, 3, 'US-PET-005'], // còn trong Product backlog để demo Sprint Planning
  ].forEach((r) => plan.run(...r));

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
    seed();
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

module.exports = { seed, seedIfEmpty, PARAMETERS };
