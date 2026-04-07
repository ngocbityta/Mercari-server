import { validate } from 'class-validator';
import { SignupDto, ChangeInfoAfterSignupDto } from './auth.dto';
import { UserRole } from '../enums/users.enum';

describe('Auth DTO Validation', () => {
    describe('SignupDto Validation', () => {
        it('TC1: Nên pass validation khi nhập đúng số điện thoại, mật khẩu và role', async () => {
            const dto = new SignupDto();
            dto.phonenumber = '0912345678';
            dto.password = 'abc123';
            dto.role = UserRole.HV;
            dto.uuid = 'device_123';

            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('TC3: Nên báo lỗi khi số điện thoại sai định dạng (không có số 0 hoặc không đủ 10 số)', async () => {
            const dto = new SignupDto();
            dto.phonenumber = '912345678'; // Thiếu số 0
            dto.password = 'abc123';
            dto.role = UserRole.HV;
            dto.uuid = 'device_123';

            let errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('phonenumber');
            expect(errors[0].constraints).toHaveProperty('matches');

            dto.phonenumber = '091234567'; // Thiếu 1 số
            errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('phonenumber');
        });

        it('TC4: Nên báo lỗi khi mật khẩu sai định dạng (ngắn, chứa ký tự đặc biệt)', async () => {
            const dto = new SignupDto();
            dto.phonenumber = '0912345678';
            dto.password = 'abc12@'; // Chứa ký tự đặc biệt
            dto.role = UserRole.HV;
            dto.uuid = 'device_123';

            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('password');
        });

        it('TC5: Nên báo lỗi khi không chọn loại user (role) hợp lệ', async () => {
            const dto = new SignupDto();
            dto.phonenumber = '0912345678';
            dto.password = 'abc123';
            dto.uuid = 'device_123';

            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('role');
        });

        it('TC6: Nên báo lỗi khi bỏ qua không nhập gì cả', async () => {
            const dto = new SignupDto();
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(1);
        });
    });

    describe('ChangeInfoAfterSignupDto Validation', () => {
        const validToken = '12345678-1234-1234-1234-123456789012'; // 36 chars

        it('TC1: Nên pass validation khi truyền đầy đủ giá trị hợp lệ', async () => {
            const dto = new ChangeInfoAfterSignupDto();
            dto.token = validToken;
            dto.username = 'Nguyen Van A';
            dto.avatar = 'http://example.com/avatar.png';
            dto.height = '175';

            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('TC2: Mã phiên quá ngắn hoặc bị trống sẽ bị báo lỗi', async () => {
            const dtoEmpty = new ChangeInfoAfterSignupDto();
            dtoEmpty.token = ''; // Trống
            dtoEmpty.username = 'Nguyen Van A';

            let errors = await validate(dtoEmpty);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('token');
            expect(errors[0].constraints).toHaveProperty('isNotEmpty');

            const dtoShort = new ChangeInfoAfterSignupDto();
            dtoShort.token = 'abc'; // Quá ngắn
            dtoShort.username = 'Nguyen Van A';

            errors = await validate(dtoShort);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('token');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('TC4: Username chứa ký tự đặc biệt sẽ bị từ chối', async () => {
            const dto = new ChangeInfoAfterSignupDto();
            dto.token = validToken;
            dto.username = 'Nguyen Van A @!'; // Chứa ký tự đặc biệt

            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('username');
            expect(errors[0].constraints).toHaveProperty('matches');
        });
    });
});
