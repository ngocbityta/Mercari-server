# Pose Grading API Documentation

---

## POST `/it4788/add_post`

Tạo bài viết mới. Nếu bài viết có `exercise_id`, hệ thống sẽ **tự động chấm điểm trong nền**.

### Request Body (`multipart/form-data`)

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | string | ✅ | Token xác thực người dùng |
| `exercise_id` | string | ❌ | ID bài tập gốc của GV. Nếu có → kích hoạt auto-grading |
| `left_video` | file | ❌ | Video tay trái |
| `right_video` | file | ❌ | Video tay phải |
| `described` | string | ❌ | Nội dung mô tả bài viết |
| `device_master` | string | ✅ | Thiết bị chính |
| `device_slave` | string | ❌ | Thiết bị phụ |

### Response `200 OK`

```json
{
    "code": "1000",
    "message": "OK",
    "data": {
        "id": "post_id"
    }
}
```

### Lưu ý

> Sau khi nhận response `200 OK`, hệ thống bắt đầu chấm điểm nền.
> Client cần gọi `get_comment` sau **~10–15 giây** để lấy kết quả.

---

## POST `/it4788/get_comment`

Lấy danh sách comment của bài viết. Dùng để **kiểm tra kết quả chấm điểm**.

### Request Body (`application/json`)

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | string | ✅ | Token xác thực người dùng |
| `id` | string | ✅ | ID bài viết |
| `index` | string | ✅ | Trang hiện tại (bắt đầu từ `"0"`) |
| `count` | string | ✅ | Số lượng comment mỗi trang |

### Response `200 OK`

#### Ví dụ 1: Chấm điểm thành công (Trả về điểm số và chi tiết khoảng cách)
```json
{
    "code": "1000",
    "message": "OK",
    "data": {
        "data": [
            {
                "id": "comment_id",
                "comment": null,
                "score": "85",
                "detail_mistakes": "<div class=\"pose-grading-detail\"><h3>Chi tiết chấm điểm bằng DTW</h3><p><strong>Điểm trung bình:</strong> 85</p><table border=\"1\" cellpadding=\"6\" cellspacing=\"0\"><thead><tr><th>Video</th><th>Điểm</th><th>Khoảng cách DTW</th><th>Danh sách lỗi sai / nhận xét</th></tr></thead><tbody><tr><td>Bên trái</td><td>82</td><td>0.12</td><td><ul><li>Video bên trái: có sai lệch nhỏ so với video mẫu; cần giữ ổn định nhịp và biên độ động tác.</li></ul></td></tr><tr><td>Bên phải</td><td>88</td><td>0.08</td><td><ul><li>Video bên phải: động tác gần giống video mẫu, chưa phát hiện lỗi lớn.</li></ul></td></tr></tbody></table><h4>Tổng kết</h4><ul><li>Hai video có mức sai lệch tương đối gần nhau; nên luyện lại đồng đều cả hai bên.</li></ul></div>",
                "created": "2026-06-09T15:14:33.063683Z",
                "poster": {
                    "id": "00000000-0000-0000-0000-000000000001",
                    "name": "Hệ thống",
                    "avatar": ""
                }
            }
        ],
        "is_blocked": "0"
    }
}
```

#### Ví dụ 2: Chấm điểm thất bại (Trả về thông báo lỗi chi tiết từ server chấm điểm)
```json
{
    "code": "1000",
    "message": "OK",
    "data": {
        "data": [
            {
                "id": "comment_id",
                "comment": "There are no longer any instances available with the requested specifications. Please refresh and try again.",
                "score": null,
                "detail_mistakes": null,
                "created": "2026-06-09T15:16:12.124567Z",
                "poster": {
                    "id": "00000000-0000-0000-0000-000000000001",
                    "name": "Hệ thống",
                    "avatar": ""
                }
            }
        ],
        "is_blocked": "0"
    }
}
```

### Nhận biết kết quả chấm điểm

Comment do hệ thống tạo có `poster.id = "00000000-0000-0000-0000-000000000001"`.

| Trạng thái | Dấu hiệu | Hành động client |
|---|---|---|
| ✅ Chấm thành công | `score` có giá trị điểm (VD: `"85"`), `comment` thường là `null` | Hiển thị điểm |
| ❌ Chấm thất bại | `score` = `null`, `comment` chứa nội dung thông báo lỗi cố định | Hiển thị lỗi từ trường `comment` + nút **"Chấm lại"** (chỉ GV) |
| ⏳ Đang xử lý | Chưa có comment của SystemBot | Đợi thêm khoảng 10-15s, thử lại sau |

> [!NOTE]
> Trường `detail_mistakes` hiện trả về một đoạn HTML tĩnh để client có thể hiển thị bảng/lists lỗi sai.
> Nếu GradingServer trả thêm dữ liệu chi tiết như `mistakes`, `feedback`, `analysis` hoặc `detail_mistakes` trong `job_output`, Mercari-server sẽ ưu tiên đưa dữ liệu đó vào bảng.
> Nếu GradingServer chỉ trả `score` và `raw_distance`, Mercari-server vẫn tự sinh nhận xét dựa trên điểm từng bên và khoảng cách DTW để người học không chỉ nhìn thấy mỗi điểm.

> [!NOTE]
> **Cơ chế trả lỗi khi chấm thất bại:**
> Khi xảy ra bất kỳ lỗi nào trong quá trình tự động chấm điểm (lỗi kết nối, lỗi API chấm điểm, lỗi hạ tầng không khởi tạo được instance GPU,...), Mercari-server sẽ tạo comment của Hệ thống với nội dung lỗi cố định là:
> `"There are no longer any instances available with the requested specifications. Please refresh and try again."`
> Client chỉ cần hiển thị nguyên văn nội dung của trường `comment` này lên màn hình.

---

## POST `/it4788/regrade_post`

Yêu cầu chấm điểm lại một bài viết. Chỉ dành cho **Giáo viên (GV)**.

Hệ thống sẽ:
1. Xóa toàn bộ comment chấm điểm cũ của SystemBot
2. Gửi lại job chấm điểm đến GradingServer
3. Ghi kết quả mới vào comment

### Request Body (`application/json`)

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | string | ✅ | Token của GV |
| `id` | string | ✅ | ID bài viết của học sinh cần chấm lại |

### Response `200 OK`

```json
{
    "code": "1000",
    "message": "OK",
    "data": {}
}
```

### Error Responses

| Code | Message | Mô tả |
|---|---|---|
| `9998` | Token is invalid | Token không hợp lệ hoặc hết hạn |
| `9995` | Account is locked | Tài khoản bị khóa |
| `1009` | Not access | Người dùng không phải GV |
| `9992` | Post not found | Bài viết không tồn tại |
| `1004` | Post is not a student submission | Bài viết không có `exercise_id` |

### Lưu ý

> API trả về ngay lập tức **không chờ** kết quả chấm.
> Sau khi nhận `200 OK`, client cần gọi lại `get_comment` sau **~10–15 giây** để lấy kết quả mới.
