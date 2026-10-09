import { useEffect, useState } from "react";
import { Camera, ImagePlus, X, ZoomIn } from "lucide-react";
import { type Photo } from "./model";
function useURL(blob?: Blob) {
  const [url, set] = useState("");
  useEffect(() => {
    if (!blob) {
      set("");
      return;
    }
    const u = URL.createObjectURL(blob);
    set(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
function Image({ photo, onClick }: { photo: Photo; onClick?: () => void }) {
  const url = useURL(photo.blob);
  return (
    <img src={url} alt={`${photo.date} ${photo.part}`} onClick={onClick} />
  );
}
export function Photos({
  date,
  photos,
  add,
  remove,
  update,
}: {
  date: string;
  photos: Photo[];
  add: (p: Photo) => Promise<void>;
  remove: (id: string) => void;
  update: (p: Photo) => Promise<void>;
}) {
  const [part, setPart] = useState("面部"),
    [custom, setCustom] = useState(""),
    [note, setNote] = useState(""),
    [photoDate, setDate] = useState(date),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState<Photo | null>(null),
    [compare, setCompare] = useState(false),
    [filter, setFilter] = useState("面部"),
    [a, setA] = useState(""),
    [b, setB] = useState("");
  useEffect(() => setDate(date), [date]);
  const parts = [
    ...new Set(["面部", "手臂", "腿部", "头皮", ...photos.map((p) => p.part)]),
  ];
  const filtered = photos
    .filter((p) => p.part === filter)
    .sort((a, b) => a.date.localeCompare(b.date));
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!photoDate || !(part === "自定义" ? custom.trim() : part)) {
      setError("请填写日期和部位");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError("照片超过40MB，请选择较小的照片。");
      return;
    }
    setBusy(true);
    try {
      let blob: Blob = file;
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      try {
        img.src = url;
        await img.decode();
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")!.drawImage(img, 0, 0);
          blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (x) => (x ? resolve(x) : reject(new Error("转换失败"))),
              "image/jpeg",
              0.96,
            ),
          );
        }
      } finally {
        URL.revokeObjectURL(url);
      }
      await add({
        id: crypto.randomUUID(),
        date: photoDate,
        part: part === "自定义" ? custom.trim() : part,
        note,
        type: blob.type,
        blob,
      });
      setNote("");
    } catch {
      setError(
        "照片无法读取或保存。请将 HEIC 导出为 JPEG 后重试，或检查剩余空间。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="card">
        <div className="section-title">
          <h2>照片观察</h2>
          <Camera size={21} />
        </div>
        <p className="muted">自愿记录，不影响日常记录。照片仅保存在本设备。</p>
        <details>
          <summary>保持拍摄条件相似</summary>
          <p>
            尽量使用相同设备、距离、角度和光线，避免美颜和滤镜，选择相似的护理前后时间点。光线差异会影响泛红、油光与纹理的判断。
          </p>
        </details>
        <div className="form-grid">
          <label>
            照片日期
            <input
              type="date"
              value={photoDate}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            部位
            <select value={part} onChange={(e) => setPart(e.target.value)}>
              {parts.map((p) => (
                <option key={p}>{p}</option>
              ))}
              <option>自定义</option>
            </select>
          </label>
        </div>
        {part === "自定义" && (
          <input
            aria-label="自定义部位"
            placeholder="例如：左上臂"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
        <input
          aria-label="照片备注"
          placeholder="照片备注（可选）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="row">
          <label className="button upload">
            <Camera size={18} />
            拍照
            <input
              disabled={busy}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <label className="button secondary upload">
            <ImagePlus size={18} />
            从相册选择
            <input
              disabled={busy}
              type="file"
              accept="image/*"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {busy && <p role="status">正在保存照片…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="photo-grid">
          {photos
            .filter((p) => p.date === date)
            .map((p) => (
              <button
                className="photo-tile"
                key={p.id}
                onClick={() => setView(p)}
              >
                <Image photo={p} />
                <span>
                  {p.part} · {p.date}
                </span>
              </button>
            ))}
        </div>
        <button className="link" onClick={() => setCompare(true)}>
          浏览全部照片与对比（{photos.length}）
        </button>
      </section>
      {view && (
        <div
          className="modal photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="照片详情"
        >
          <div className="modal-panel">
            <button
              className="close"
              aria-label="关闭"
              onClick={() => setView(null)}
            >
              <X />
            </button>
            <h2>
              {view.part} · {view.date}
            </h2>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Original photo={view} />
            <p className="muted">
              原始文件按浏览器方向信息显示；双指缩放页面可查看细节。
            </p>
            <label>
              日期
              <input
                type="date"
                value={view.date}
                onChange={(e) => setView({ ...view, date: e.target.value })}
              />
            </label>
            <label>
              部位
              <input
                value={view.part}
                onChange={(e) => setView({ ...view, part: e.target.value })}
              />
            </label>
            <label>
              备注
              <textarea
                value={view.note}
                onChange={(e) => setView({ ...view, note: e.target.value })}
              />
            </label>
            <div className="row">
              <button
                onClick={() => {
                  if (!view.date || !view.part.trim()) return;
                  void update(view)
                    .then(() => setView(null))
                    .catch(() =>
                      setError("照片信息保存失败，请保留页面并重试。"),
                    );
                }}
              >
                保存照片信息
              </button>
              <button
                className="danger secondary"
                onClick={() => {
                  if (confirm("确定删除这张照片及其本地文件？")) {
                    remove(view.id);
                    setView(null);
                  }
                }}
              >
                删除照片
              </button>
            </div>
          </div>
        </div>
      )}
      {compare && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="照片对比"
        >
          <div className="modal-panel wide">
            <button
              className="close"
              aria-label="关闭"
              onClick={() => setCompare(false)}
            >
              <X />
            </button>
            <h2>同部位照片对比</h2>
            <label>
              部位
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setA("");
                  setB("");
                }}
              >
                {parts.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <div className="photo-grid">
              {filtered.map((p) => (
                <button
                  className="photo-tile"
                  key={p.id}
                  onClick={() => setView(p)}
                >
                  <Image photo={p} />
                  <span>{p.date}</span>
                </button>
              ))}
            </div>
            {filtered.length < 2 ? (
              <p className="muted">同一部位至少需要两张照片才能对比。</p>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    照片 A
                    <select
                      value={a || filtered[0].id}
                      onChange={(e) => setA(e.target.value)}
                    >
                      {filtered.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.date} · {p.note || p.id.slice(0, 4)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    照片 B
                    <select
                      value={b || filtered[filtered.length - 1].id}
                      onChange={(e) => setB(e.target.value)}
                    >
                      {filtered.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.date} · {p.note || p.id.slice(0, 4)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Comparison
                  a={filtered.find((p) => p.id === (a || filtered[0].id))!}
                  b={filtered.find(
                    (p) => p.id === (b || filtered[filtered.length - 1].id),
                  )!}
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
function Original({ photo }: { photo: Photo }) {
  const url = useURL(photo.blob);
  return (
    <>
      <a href={url} target="_blank" rel="noopener" className="original">
        <img src={url} alt={`${photo.date} ${photo.part}`} />
      </a>
      <a className="button secondary" href={url} target="_blank" rel="noopener">
        打开原图
      </a>
    </>
  );
}
function Comparison({ a, b }: { a: Photo; b: Photo }) {
  const ua = useURL(a.blob),
    ub = useURL(b.blob);
  const [mode, setMode] = useState("side"),
    [split, setSplit] = useState(50),
    [target, setTarget] = useState<"a" | "b">("b"),
    [t, setT] = useState({
      a: { zoom: 1, x: 0, y: 0 },
      b: { zoom: 1, x: 0, y: 0 },
    });
  const style = (key: "a" | "b") => ({
    transform: `translate(${t[key].x}%,${t[key].y}%) scale(${t[key].zoom})`,
  });
  return (
    <>
      <div className="segments">
        <button
          className={mode === "side" ? "selected" : ""}
          onClick={() => setMode("side")}
        >
          并排对比
        </button>
        <button
          className={mode === "slide" ? "selected" : ""}
          onClick={() => setMode("slide")}
        >
          滑动对比
        </button>
      </div>
      <div className="row">
        <span>A · {a.date}</span>
        <span>B · {b.date}</span>
      </div>
      <div className={`compare ${mode}`}>
        {mode === "side" ? (
          <>
            <div>
              <img src={ua} alt="照片A" style={style("a")} />
            </div>
            <div>
              <img src={ub} alt="照片B" style={style("b")} />
            </div>
          </>
        ) : (
          <>
            <img src={ub} alt="照片B" style={style("b")} />
            <div
              className="clip"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            >
              <img src={ua} alt="照片A" style={style("a")} />
            </div>
            <div className="divider" style={{ left: `${split}%` }} />
            <input
              aria-label="拖动照片对比分割线"
              className="split"
              type="range"
              min="0"
              max="100"
              value={split}
              onChange={(e) => setSplit(+e.target.value)}
            />
          </>
        )}
      </div>
      <label>
        分割位置
        <input
          aria-label="分割位置"
          type="range"
          min="0"
          max="100"
          value={split}
          onChange={(e) => setSplit(+e.target.value)}
        />
      </label>
      <label>
        调整照片
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as "a" | "b")}
        >
          <option value="a">A</option>
          <option value="b">B</option>
        </select>
      </label>
      {(
        [
          ["zoom", "缩放", 1, 4, 0.05],
          ["x", "水平位置", -70, 70, 1],
          ["y", "垂直位置", -70, 70, 1],
        ] as const
      ).map(([key, label, min, max, step]) => (
        <label key={key}>
          {label} {key === "zoom" ? t[target][key].toFixed(2) : t[target][key]}
          <input
            aria-label={label}
            type="range"
            min={min}
            max={max}
            step={step}
            value={t[target][key]}
            onChange={(e) =>
              setT({ ...t, [target]: { ...t[target], [key]: +e.target.value } })
            }
          />
        </label>
      ))}
      <button
        className="secondary"
        onClick={() =>
          setT({ a: { zoom: 1, x: 0, y: 0 }, b: { zoom: 1, x: 0, y: 0 } })
        }
      >
        <ZoomIn size={16} />
        重置对齐
      </button>
      <p className="muted">
        手动对齐仅影响查看，不修改照片。不同光线和角度会影响判断。
      </p>
    </>
  );
}
