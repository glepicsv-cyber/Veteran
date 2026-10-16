# Người Đi Trước — game H5

Game sinh tồn theo chương, dựng theo GDD "Người Đi Trước". Viết bằng HTML5 Canvas và JavaScript thuần, không cần build.
Code chỉ làm nhiệm vụ nạp và hiển thị. Toàn bộ hình ảnh, âm thanh và dữ liệu game nằm trong các tệp riêng.

## Chạy game
Game nạp dữ liệu bằng `fetch`, nên phải chạy qua máy chủ web (mở thẳng `index.html` từ ổ đĩa sẽ không chạy):

```bash
python -m http.server 8765 --directory game
```

Sau đó mở http://localhost:8765. Để phát hành, tải nguyên thư mục `game/` lên cổng game web, Zalo Mini App hoặc Telegram Mini App.

## Cấu trúc thư mục

```
game/
  index.html, css/style.css
  js/            code: nạp asset, vòng lặp, luật đảo, giao diện
  data/          dữ liệu game (JSON)
  assets/        hình ảnh, âm thanh và danh sách khai báo
```

### data/ — dữ liệu game
| Tệp | Nội dung |
|---|---|
| `config.json` | Thời gian ngày–đêm, tốc độ đói/khát/thể lực, tốc độ di chuyển, hồi sinh, tự lưu |
| `tiles.json` | Các loại ô địa hình: ký tự trên bản đồ, đi được không, bóng râm, ảnh dùng để vẽ |
| `items.json` | Vật phẩm: tên, loại, chỉ số khi ăn/uống, mô tả |
| `recipes.json` | Công thức chế tạo, nơi chế, icon |
| `raft.json` | 4 cấp bè: sức chứa, tốc độ, chịu sóng |
| `journal.json` | 20 trang nhật ký, lá thư gửi Bống, di vật |
| `endings.json` | 4 kết thúc |
| `story.json` | Lời thoại: mở đầu, gặp Lâm, lời mời, gục ngã… (`{name}` là tên nhân vật) |
| `sea.json` | Chặng biển: sự kiện từng chặng, sát thương, đồ vớt được |
| `looks.json` | Tài nguyên nhặt được: nhãn nút và ảnh |
| `islands/islandN.json` | Từng đảo, xem bên dưới |

Mỗi tệp đảo gồm:
- `map`: bản đồ vẽ bằng ký tự, mỗi dòng là một hàng ô. Bảng ký tự nằm trong `tiles.json` (`~` biển sâu, `-` nước nông, `.` cát, `f` rừng, `#` vách đá…). Sửa bản đồ bằng cách sửa ký tự.
- `low`: vùng ngập khi triều lên (đảo 2). `tag`: dải dung nham (đảo 3).
- `zones`: tên khu vực.
- `presets` + `ents`: vật thể. Mỗi dòng có dạng `[mẫu, x, y, {thuộc tính riêng}]`.
- `main`, `side`: nhiệm vụ. Điều kiện hoàn thành viết dạng JSON, ví dụ `{"count":"debris","n":3}`, `{"all":[{"flag":"a"},{"has":"bark_sandals"}]}`, `{"raft":2}`, `{"explore":70}`. Tiến độ viết dạng `"{c:debris}/3"`.
- `params`: thông số luật đảo (chu kỳ triều, thời gian phun trào, ánh sáng đuốc, giấc ngủ của rùa…).

### assets/ — hình ảnh và âm thanh
- `assets/sprites.json`: khai báo mọi ảnh trong game: đường dẫn, kích thước hiển thị (đơn vị: 1 ô = 32), điểm neo (`ax`, `ay`) và hoạt hình (`frames`, `fps`).
- `assets/img/tiles` (ô địa hình 32×32, lát liền mạch), `sprites` (nhân vật, cây cối, công trình), `fx` (hiệu ứng), `sea` (chặng biển), `bg` (nền tiêu đề, cảnh kết, ảnh chia sẻ), `icons` (icon vật phẩm, công thức, giao diện; tên tệp trùng id vật phẩm).
- `assets/audio.json` và `assets/audio/*.wav`: âm thanh hiệu ứng, chuông gió và tiếng sóng nền.
- `assets/preview.html`: trang xem nhanh toàn bộ asset. Mở qua máy chủ: http://localhost:8765/assets/preview.html

**Thay đồ họa:** hiện các ảnh là bản SVG tạm. Họa sĩ có thể thay bằng ảnh mới cùng tên, hoặc dùng PNG rồi sửa `src` trong `sprites.json`. Kích thước và điểm neo cũng chỉnh trong tệp đó. Âm thanh thay tương tự qua `audio.json`.

Sau khi đổi code hoặc asset, tăng số `?v=` trong `index.html` để trình duyệt không dùng bản cũ trong bộ nhớ đệm.

## Điều khiển
- Di động (màn hình ngang): chạm và kéo ở nửa trái màn hình để đi. Nút tròn lớn để Tương tác, nút xanh là hành động phụ, có nút Chạy và nút Chế tạo.
- Bàn phím: WASD/mũi tên, E/Space = tương tác, Q = hành động phụ, Shift = chạy, C = chế tạo, I = túi đồ, J = nhật ký, M = bản đồ, Esc = tạm dừng.

## Khác với GDD (đã chỉnh để dễ chơi)
- Núi lửa phun 5 phút một lần (lần đầu sau khoảng 3 phút 20 giây), thay vì mỗi ngày game. Chỉnh trong `params` của `island3.json`.
- Mỗi đảo được thu gọn để chơi khoảng 15–30 phút.
- Chưa làm: Hải trình hằng ngày (cần máy chủ), kiếm tiền và quảng cáo, đồng bộ đám mây.
