# Orbit Climb

Game 2D one-tap viết bằng HTML Canvas + JavaScript thuần, không cần build.

## Chơi

Mở `index.html` bằng trình duyệt (hoặc `npx serve .`).

- **Chạm / Space / ↑** để phóng viên bi khỏi quỹ đạo theo hướng tiếp tuyến.
- Bay lọt vào **vòng hút** của hành tinh phía trên để bám vào nó.
- Nhắm **trúng tâm** → `PERFECT`, chuỗi PERFECT liên tiếp tạo combo.
- Bay lọt qua vòng hút của hành tinh xa hơn → `NHẢY CÓC`, được cộng nhiều điểm.
- Mỗi hành tinh **sụp đổ** sau vài giây (vòng trắng sẽ chuyển đỏ khi sắp hết giờ).
- Cứ 10 hành tinh là lên một **zone** mới: Mặt đất → Tầng mây → … → Vô tận.

## Thiết kế "gây nghiện"

| Yếu tố | Mục đích |
| --- | --- |
| Một nút bấm, chết là chơi lại ngay | Vào game không mất công, chơi thêm ván nữa không tốn gì |
| Vạch `KỶ LỤC` hiện ngay trong màn chơi | Người chơi thấy trước mục tiêu cần vượt |
| Vạch mốc zone kế tiếp + thanh tiến độ | Luôn có mục tiêu gần để hướng tới |
| Hành tinh sụp đổ theo thời gian | Không đứng chờ được mãi, lúc nào cũng có áp lực |
| Độ khó tăng dần: vòng hút nhỏ lại, quay nhanh hơn, có hành tinh di chuyển | Cảm giác mình ngày càng giỏi lên |
| Game over báo "chỉ còn N nữa thôi!" | Khiến người chơi muốn thử thêm ván nữa |

## Cấu trúc

- `game.js`: logic game (state, vật lý, input) và phần render mỗi frame.
- `art.js`: tạo sprite hành tinh, mây, sao và tinh vân. Mỗi sprite vẽ một lần vào offscreen canvas rồi dùng lại ở mọi frame, nên game giữ được 60 FPS.
