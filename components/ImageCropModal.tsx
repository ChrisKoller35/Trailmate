import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Image,
  PanResponder,
  StyleSheet,
  Dimensions,
  Pressable,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type CropRect = { x: number; y: number; w: number; h: number };

interface Props {
  visible: boolean;
  uri: string;
  originalWidth: number;
  originalHeight: number;
  /** width/height ratio — null means free crop */
  fixedRatio: number | null;
  onConfirm: (crop: { originX: number; originY: number; width: number; height: number }) => void;
  onCancel: () => void;
}

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_H    = Math.round(SH * 0.62);  // card takes ~62% of screen height
const CARD_W    = SW - 32;                // 16px margin each side
const HDR       = 48;
const FTR       = 44;
const PAD       = 10;
const HL        = 20;
const HT        = 3;
const CH        = 36;
const MIN       = 50;

export default function ImageCropModal({
  visible, uri, originalWidth, originalHeight, fixedRatio, onConfirm, onCancel,
}: Props) {

  // ── Target display size (integer pixels, fits inside card) ──
  const aW = CARD_W - PAD * 2;
  const aH = CARD_H - HDR - FTR - PAD * 2;
  const rawH = aW * (originalHeight / originalWidth);
  const dW = rawH <= aH
    ? Math.floor(aW)
    : Math.floor(aH * (originalWidth / originalHeight));
  const dH = rawH <= aH
    ? Math.floor(rawH)
    : Math.floor(aH);

  // ── Actual rendered dimensions (filled by onLayout) ─────────
  // PanResponder closures capture this ref → always get live values
  const layout = useRef({ w: dW, h: dH });

  // ── Initial crop box ────────────────────────────────────────
  const makeInit = (): CropRect => {
    const { w, h } = layout.current;
    if (!fixedRatio) return { x: 0, y: 0, w, h };
    let cw = w, ch = cw / fixedRatio;
    if (ch > h) { ch = h; cw = ch * fixedRatio; }
    return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  };

  const [rect, setRect] = useState<CropRect>(makeInit);
  const rRef = useRef<CropRect>(rect);
  const s0 = useRef<CropRect>(rect);

  useEffect(() => { rRef.current = rect; }, [rect]);
  useEffect(() => {
    if (visible) {
      const c = makeInit();
      rRef.current = c;
      setRect(c);
    }
  }, [visible]);

  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const upd = (r: CropRect) => { rRef.current = r; setRect(r); };

  // ── Box drag ────────────────────────────────────────────────
  const boxPR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { s0.current = { ...rRef.current }; },
      onPanResponderMove: (_, g) => {
        const { w: lw, h: lh } = layout.current;
        const s = s0.current, c = rRef.current;
        upd({ ...c, x: cl(s.x + g.dx, 0, lw - c.w), y: cl(s.y + g.dy, 0, lh - c.h) });
      },
    })
  ).current;

  // ── Corner drag ─────────────────────────────────────────────
  const mkCPR = (corner: 'tl' | 'tr' | 'bl' | 'br') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { s0.current = { ...rRef.current }; },
      onPanResponderMove: (_, g) => {
        const { w: lw, h: lh } = layout.current;
        const s = s0.current;
        let { x, y, w, h } = s;

        switch (corner) {
          case 'br':
            w = Math.max(MIN, s.w + g.dx);
            h = fixedRatio ? w / fixedRatio : Math.max(MIN, s.h + g.dy);
            break;
          case 'bl':
            w = Math.max(MIN, s.w - g.dx);
            h = fixedRatio ? w / fixedRatio : Math.max(MIN, s.h + g.dy);
            x = s.x + s.w - w;
            break;
          case 'tr':
            w = Math.max(MIN, s.w + g.dx);
            h = fixedRatio ? w / fixedRatio : Math.max(MIN, s.h - g.dy);
            y = s.y + s.h - h;
            break;
          case 'tl':
            w = Math.max(MIN, s.w - g.dx);
            h = fixedRatio ? w / fixedRatio : Math.max(MIN, s.h - g.dy);
            x = s.x + s.w - w;
            y = s.y + s.h - h;
            break;
        }

        // Clamp to image bounds
        if (x < 0) { w += x; if (fixedRatio) h = w / fixedRatio; x = 0; }
        if (y < 0) { h += y; if (fixedRatio) w = h * fixedRatio; y = 0; }
        if (x + w > lw) { w = lw - x; if (fixedRatio) h = w / fixedRatio; }
        if (y + h > lh) { h = lh - y; if (fixedRatio) w = h * fixedRatio; }

        upd({ x, y, w: Math.max(MIN, w), h: Math.max(MIN, h) });
      },
    });

  const tlPR = useRef(mkCPR('tl')).current;
  const trPR = useRef(mkCPR('tr')).current;
  const blPR = useRef(mkCPR('bl')).current;
  const brPR = useRef(mkCPR('br')).current;

  // ── Confirm — use actual rendered size for accurate mapping ──
  const handleConfirm = () => {
    const c = rRef.current;
    const { w: lw, h: lh } = layout.current;
    const sx = originalWidth / lw;
    const sy = originalHeight / lh;

    // Use floor for origin (never start outside image),
    // floor for size, then clamp so crop stays within bounds.
    const originX = Math.floor(c.x * sx);
    const originY = Math.floor(c.y * sy);
    const cropW   = Math.min(Math.floor(c.w * sx), originalWidth  - originX);
    const cropH   = Math.min(Math.floor(c.h * sy), originalHeight - originY);

    onConfirm({
      originX,
      originY,
      width:  Math.max(1, cropW),
      height: Math.max(1, cropH),
    });
  };

  const { x, y, w, h } = rect;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={ss.overlay}>
      <View style={ss.card}>

        {/* Header */}
        <View style={ss.hdr}>
          <Pressable onPress={onCancel} hitSlop={16}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Text style={ss.title}>Zuschneiden</Text>
          <Pressable onPress={handleConfirm} style={ss.confirmBtn}>
            <Text style={ss.confirmTxt}>Übernehmen</Text>
          </Pressable>
        </View>

        {/* Canvas */}
        <View style={ss.canvas}>
          <View
            style={{ width: dW, height: dH }}
            onLayout={(e) => {
              const { width: lw, height: lh } = e.nativeEvent.layout;
              layout.current = { w: lw, h: lh };
              // Re-init the crop box after we know the actual size
              const c = makeInit();
              rRef.current = c;
              setRect(c);
            }}
          >
            {/* Image — stretch fills exactly, 1:1 pixel mapping */}
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />

            {/* Dark overlay — 4 regions around the crop box */}
            <View style={[ss.ov, { top: 0,     left: 0, right: 0, height: y }]}      pointerEvents="none" />
            <View style={[ss.ov, { top: y + h, left: 0, right: 0, bottom: 0 }]}     pointerEvents="none" />
            <View style={[ss.ov, { top: y,     left: 0, width: x, height: h }]}      pointerEvents="none" />
            <View style={[ss.ov, { top: y,     left: x + w, right: 0, height: h }]}  pointerEvents="none" />

            {/* Crop box */}
            <View style={[ss.box, { left: x, top: y, width: w, height: h }]} {...boxPR.panHandlers}>

              {/* Rule-of-thirds grid */}
              <View style={[ss.gl, { left: w / 3,       top: 0, width: 1, height: h }]} pointerEvents="none" />
              <View style={[ss.gl, { left: (w * 2) / 3, top: 0, width: 1, height: h }]} pointerEvents="none" />
              <View style={[ss.gl, { left: 0, top: h / 3,       width: w, height: 1 }]} pointerEvents="none" />
              <View style={[ss.gl, { left: 0, top: (h * 2) / 3, width: w, height: 1 }]} pointerEvents="none" />

              {/* Corner handles — L-shaped */}
              <View style={[ss.ch, ss.chTL]} {...tlPR.panHandlers}>
                <View style={[ss.cb, { top: 0,    left: 0,  width: HL, height: HT }]} />
                <View style={[ss.cb, { top: 0,    left: 0,  width: HT, height: HL }]} />
              </View>
              <View style={[ss.ch, ss.chTR]} {...trPR.panHandlers}>
                <View style={[ss.cb, { top: 0,    right: 0, width: HL, height: HT }]} />
                <View style={[ss.cb, { top: 0,    right: 0, width: HT, height: HL }]} />
              </View>
              <View style={[ss.ch, ss.chBL]} {...blPR.panHandlers}>
                <View style={[ss.cb, { bottom: 0, left: 0,  width: HL, height: HT }]} />
                <View style={[ss.cb, { bottom: 0, left: 0,  width: HT, height: HL }]} />
              </View>
              <View style={[ss.ch, ss.chBR]} {...brPR.panHandlers}>
                <View style={[ss.cb, { bottom: 0, right: 0, width: HL, height: HT }]} />
                <View style={[ss.cb, { bottom: 0, right: 0, width: HT, height: HL }]} />
              </View>

            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={ss.ftr}>
          <Text style={ss.hint}>Verschieben oder Ecken ziehen zum Anpassen</Text>
        </View>

      </View>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
                alignItems: 'center', justifyContent: 'center' },
  card:       { width: CARD_W, height: CARD_H, backgroundColor: '#1c1c1c',
                borderRadius: 16, overflow: 'hidden' },
  hdr:        { height: HDR, flexDirection: 'row', alignItems: 'center',
                justifyContent: 'space-between', paddingHorizontal: 14 },
  title:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  confirmBtn: { backgroundColor: '#2a7f3e', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  confirmTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  canvas:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ov:         { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.58)' },
  box:        { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  gl:         { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.3)' },
  ch:         { position: 'absolute', width: CH, height: CH },
  chTL:       { top: -HT,    left: -HT  },
  chTR:       { top: -HT,    right: -HT },
  chBL:       { bottom: -HT, left: -HT  },
  chBR:       { bottom: -HT, right: -HT },
  cb:         { position: 'absolute', backgroundColor: '#fff' },
  ftr:        { height: FTR, alignItems: 'center', justifyContent: 'center' },
  hint:       { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
});
