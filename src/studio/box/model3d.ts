import { Box3, BufferAttribute, BufferGeometry, CanvasTexture, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, BackSide, FrontSide, ShapeUtils, SRGBColorSpace, Vector2, type Material } from "three";
import { hingeAngle, outlineOf, smooth, type BoxSpec, type Flat, type Hinge, type Panel, type Piece, type Pt } from "./dielines";
import { BLEED, rawBoard, type Sheet } from "./art";
import { FINISHES, boardColor, type BoxDesign } from "./types";

// المجسم المطوي: كل لوح شريحة بسماكة الخامة (وجه خارجي مطبوع من ورقة الطباعة، وجه داخلي، وحافة)،
// وكل مفصل محور دوران. الطي = تدوير المحاور بالترتيب.

const D2R = Math.PI / 180;

interface UvMap {
  minX: number;
  maxY: number;
  wMm: number;
  hMm: number;
}
const uvOf = (m: UvMap, X: number, Y: number) => [(X - m.minX + BLEED) / m.wMm, 1 - (m.maxY - Y + BLEED) / m.hMm];

/** شريحة مضلعة: z=0 الوجه الخارجي، z=-t الداخلي. المجموعات: 0 خارجي، 1 داخلي، 2 حافة */
export function slab(outline: Pt[], t: number, ox: number, oy: number, m: UvMap): BufferGeometry {
  let pts = outline;
  // عكس الاتجاه إن لزم ليكون الوجه الخارجي باتجاه +z
  let area = 0;
  for (let i = 0; i < pts.length; i++) area += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1];
  if (area < 0) pts = [...pts].reverse();
  const tris = ShapeUtils.triangulateShape(pts.map(([x, y]) => new Vector2(x, y)), []);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const vert = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    uv.push(...uvOf(m, ox + x, oy + y));
  };
  const geo = new BufferGeometry();
  let start = 0;
  // الخارجي
  for (const [a, b, c] of tris) {
    const [A, B, C] = [pts[a], pts[b], pts[c]];
    const ccw = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0;
    for (const P of ccw ? [A, B, C] : [A, C, B]) vert(P[0], P[1], 0, 0, 0, 1);
  }
  geo.addGroup(start, pos.length / 3 - start, 0);
  start = pos.length / 3;
  // الداخلي (اتجاه معكوس)
  for (const [a, b, c] of tris) {
    const [A, B, C] = [pts[a], pts[b], pts[c]];
    const ccw = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0;
    for (const P of ccw ? [A, C, B] : [A, B, C]) vert(P[0], P[1], -t, 0, 0, -1);
  }
  geo.addGroup(start, pos.length / 3 - start, 1);
  start = pos.length / 3;
  // الحواف
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (y2 - y1) / len, ny = -(x2 - x1) / len;
    vert(x1, y1, 0, nx, ny, 0);
    vert(x1, y1, -t, nx, ny, 0);
    vert(x2, y2, 0, nx, ny, 0);
    vert(x2, y2, 0, nx, ny, 0);
    vert(x1, y1, -t, nx, ny, 0);
    vert(x2, y2, -t, nx, ny, 0);
  }
  geo.addGroup(start, pos.length / 3 - start, 2);
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  return geo;
}

interface Joint {
  pivot: Group;
  hinge: Hinge;
}

export interface BoxModel {
  group: Group;
  setPose: (fold: number, open: number) => void;
  /** الارتفاع والعرض الحاليان (متر) — لتأطير الكاميرا */
  size: () => { h: number; w: number; cx: number; cz: number };
  dispose: () => void;
}

export function buildBoxModel(design: BoxDesign, spec: BoxSpec, flat: Flat, sheet: Sheet): BoxModel {
  const m: UvMap = { minX: flat.bounds.minX, maxY: flat.bounds.maxY, wMm: sheet.wMm, hMm: sheet.hMm };
  const map = new CanvasTexture(sheet.color);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const pbr = new CanvasTexture(sheet.pbr);
  const fin = FINISHES.find((f) => f.id === design.finish) ?? FINISHES[0];
  const outer = new MeshPhysicalMaterial({ map, roughnessMap: pbr, metalnessMap: pbr, roughness: 1, metalness: 1, clearcoat: fin.clearcoat, clearcoatRoughness: 0.25, envMapIntensity: 1, side: FrontSide });
  const inner = new MeshStandardMaterial({ color: design.interior, roughness: 0.92, side: FrontSide });
  // الكرتون الصلب مغلّف بالورق فتظهر حوافه بلون الغلاف؛ الكرتون الرقيق تظهر حافته خاماً
  const wrapped = design.style === "rigid" || design.style === "magnetic";
  const edge = new MeshStandardMaterial({ color: wrapped ? boardColor(design) : rawBoard(design), roughness: 0.9 });
  const mats: Material[] = [outer, inner, edge];
  const wrapInner = new MeshStandardMaterial({ color: design.interior, roughness: 0.92, side: BackSide });

  const flatById = new Map(flat.panels.map((p) => [p.id, p]));
  const group = new Group();
  group.name = "box";
  // المقاييس بالمتر (حجم حقيقي في الواقع المعزز)
  group.scale.setScalar(0.001);
  const joints: Joint[] = [];
  const pieces: { piece: Piece; node: Group; wrap?: { mesh: Mesh; back: Mesh; build: (p: number) => void } }[] = [];

  const buildPanel = (p: Panel): Group => {
    const g = new Group();
    g.name = p.id;
    const fp = flatById.get(p.id)!;
    const mesh = new Mesh(slab(outlineOf(p), spec.t, fp.x, fp.y, m), mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    for (const h of p.hinges) {
      if (h.crease === false) continue; // منطقة اللصق تحت الطرف الآخر — لا تظهر
      const c = h.child;
      const pivot = new Group();
      const innerG = buildPanel(c);
      if (h.edge === "right") pivot.position.set(p.w, h.at, 0);
      else if (h.edge === "left") {
        pivot.position.set(0, h.at, 0);
        innerG.position.x = -c.w;
      } else if (h.edge === "top") pivot.position.set(h.at, p.h, 0);
      else {
        pivot.position.set(h.at, 0, 0);
        innerG.position.y = -c.h;
      }
      innerG.position.z = -(c.inset ?? 0);
      pivot.add(innerG);
      g.add(pivot);
      joints.push({ pivot, hinge: h });
    }
    return g;
  };

  // الأسطوانة: ورقة تُلف تدريجياً حول محورها (نصف قطر الانحناء من ∞ إلى r)
  const buildWrap = (piece: Piece) => {
    const { d, h } = piece.wrap!;
    const fp = flatById.get(piece.root.id)!;
    const C = Math.PI * d;
    const R = d / 2;
    const N = 96;
    const geo = new BufferGeometry();
    const pos = new Float32Array((N + 1) * 2 * 3);
    const nor = new Float32Array((N + 1) * 2 * 3);
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * C;
      uv.push(...uvOf(m, fp.x + s, fp.y), ...uvOf(m, fp.x + s, fp.y + h));
      if (i < N) {
        const a = i * 2, b = a + 1, c2 = a + 2, e = a + 3;
        idx.push(a, c2, b, b, c2, e);
      }
    }
    // BufferAttribute يشير للمصفوفة نفسها (Float32BufferAttribute ينسخها فلا تصل التعديلات)
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("normal", new BufferAttribute(nor, 3));
    geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const build = (p: number) => {
      const k = Math.max(p, 1e-4);
      const Re = R / k;
      for (let i = 0; i <= N; i++) {
        // منتصف الورقة يواجه المشاهد
        const phi = ((i / N) * C - C / 2) / Re;
        const x = Re * Math.sin(phi), z = R - Re + Re * Math.cos(phi);
        const nx = Math.sin(phi), nz = Math.cos(phi);
        for (const [j, y] of [[0, 0], [1, h]] as const) {
          const o = (i * 2 + j) * 3;
          pos[o] = x;
          pos[o + 1] = y;
          pos[o + 2] = z;
          nor[o] = nx;
          nor[o + 1] = 0;
          nor[o + 2] = nz;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
    };
    const mesh = new Mesh(geo, outer);
    const back = new Mesh(geo, wrapInner);
    mesh.castShadow = true;
    back.receiveShadow = true;
    return { mesh, back, build };
  };

  for (const piece of spec.pieces) {
    const node = new Group();
    node.name = piece.id;
    if (piece.mode === "wrap") {
      const w = buildWrap(piece);
      node.add(w.mesh, w.back);
      pieces.push({ piece, node, wrap: w });
    } else {
      const root = buildPanel(piece.root);
      // القرص يدور حول مركزه
      if (piece.mode === "disc") root.position.set(-piece.root.w / 2, -piece.root.h / 2, 0);
      node.add(root);
      pieces.push({ piece, node });
    }
    group.add(node);
  }

  const box = new Box3();
  let lift = 0;
  const setPose = (f: number, o: number) => {
    for (const { pivot, hinge } of joints) {
      const a = hingeAngle(hinge, f, o, spec.stages) * D2R;
      if (hinge.edge === "right") pivot.rotation.y = a;
      else if (hinge.edge === "left") pivot.rotation.y = -a;
      else if (hinge.edge === "top") pivot.rotation.x = -a;
      else pivot.rotation.x = a;
    }
    for (const { piece, node, wrap } of pieces) {
      const pose = piece.pose(f, o);
      node.position.set(...pose.pos);
      node.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2], pose.order ?? "XYZ");
      if (wrap) wrap.build(smooth(f / 0.8));
      if (piece.mode === "disc") {
        // القرصان يظهران بعد اكتمال اللف
        const s = smooth((f - 0.72) / 0.2);
        node.scale.setScalar(Math.max(s, 1e-3));
        node.visible = s > 0.01;
      }
    }
    // يبقى المجسم فوق الأرض في كل مراحل الطي
    group.position.y = 0;
    group.updateMatrixWorld(true);
    box.setFromObject(group);
    lift = -box.min.y;
    group.position.y = lift;
  };

  return {
    group,
    setPose,
    size: () => ({ h: box.max.y - box.min.y, w: Math.max(box.max.x - box.min.x, box.max.z - box.min.z), cx: (box.max.x + box.min.x) / 2, cz: (box.max.z + box.min.z) / 2 }),
    dispose: () => {
      map.dispose();
      pbr.dispose();
      [outer, inner, edge, wrapInner].forEach((x) => x.dispose());
      group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
    },
  };
}
