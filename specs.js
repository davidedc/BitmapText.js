class Specs {

  constructor(specs) {
    this.specs = specs;
  }

  kerning(fontFamily,fontStyle,fontWeight) {
    return this.specs[fontFamily][fontStyle][fontWeight]["Kerning"];
  }

  kerningCutoff(fontFamily,fontStyle,fontWeight) {
    return this.specs[fontFamily][fontStyle][fontWeight]["Kerning cutoff"];
  }

  specCombinationExists(fontFamily, fontStyle, fontWeight, correctionKey) {
    return checkNestedPropertiesExist(this.specs, [fontFamily, fontStyle, fontWeight, correctionKey]);
  }

  getCorrectionEntry(fontFamily, fontSize, fontStyle, fontWeight, correctionKey) {
    if (!this.specCombinationExists(fontFamily, fontStyle, fontWeight, correctionKey)) {
      return null;
    }

    if (fontSize <= this.specs[fontFamily][fontStyle][fontWeight][correctionKey]) {
      return null;
    }

    for (const element of this.specs[fontFamily][fontStyle][fontWeight][correctionKey]) {
      const correctionEntry = element;
      if (correctionEntry.sizeRange == undefined) return null;
      if (correctionEntry.sizeRange.from <= fontSize && correctionEntry.sizeRange.to >= fontSize) {
        return correctionEntry;
      }
    }

    return null;
  }

  getSingleFloatCorrection(fontFamily, fontSize, fontStyle, fontWeight, correctionKey) {
    const correctionEntry = this.getCorrectionEntry(fontFamily, fontSize, fontStyle, fontWeight, correctionKey);
    return correctionEntry ? correctionEntry.correction : null;
  }

  getSingleFloatCorrectionForLetter(fontFamily, letter, nextLetter, fontSize, fontStyle, fontWeight, correctionKey, pixelDensity) {
    const correctionEntry = this.getCorrectionEntry(fontFamily, fontSize, fontStyle, fontWeight, correctionKey);
    if (!correctionEntry) return 0;

    if (pixelDensity !== null && correctionEntry.sizeRange.pixelDensity !== null && pixelDensity !== correctionEntry.sizeRange.pixelDensity) return 0;

    for (const element of correctionEntry.lettersAndTheirCorrections) {
      const charAndOffset = element;
      if (charAndOffset.string.indexOf(letter) !== -1) {
        return charAndOffset.adjustment;
      }
    }

    return 0;
  }
}

const specsText =
`Font family: Arial
Font style: normal
Font weight: normal
--
Kerning cutoff
-
0
--
Kerning
-
19 to 19
  W followed by i: -50
  y followed by w: -50
  R followed by e: 25
  r followed by coe: 0
  a followed by c: 50
  c followed by c: 50
  c followed by e: 50
  e followed by s: 0
  e followed by f: 50
  h followed by e: 50
  h followed by o: 50
  o followed by o: 50
  *any* followed by s: 20
  n followed by cdf: 50
  sc followed by et: -50
  f followed by yt: -100
  ts followed by lihya: -50
  rf followed by *any*: -50
  //i followed by f: -50
  t followed by kz: -50
  B followed by vz: -50
  YT followed by aeoprs dklcgjmnquvwxyz.,:;—·Çàç•: 50
  Y followed by i: 20
  X followed by ae: 50
  V followed by ae: 50
18 to 18
  A followed by *any*: 20
  y followed by w: -50
  f followed by i: -50
  i followed by f: -50
  t followed by z: -50
  B followed by vz: -50
  YT followed by aeoprs dklcgjmnquvwxyz.,:;—·Çàç•: 50
  Y followed by i: 20
  X followed by ae: 50
  V followed by ae: 50
17 to 17
  A followed by *any*: -50
  X followed by i: -50
  W followed by ithu: -50
  z followed by *any*: 50
  v followed by ao: 50
  d followed by t: -50
  f followed by ln: -50
  ’ followed by *any*: 50
  YT followed by aeoprs dklcgjmnquvwxyz.,:;—·Çàç•: 150
  Y followed by i: 50
16 to 16
  r followed by tfw: -50
  b followed by y: -50
  t followed by ilyhbz’: -50
  k followed by rnywvhlz: -50
  ’ followed by *any*: 50
  YT followed by aeop: 100
  YT followed by dklcgijmnqrsuvwxyz.,:;—·Çàç•: 50
15 to 15
  F followed by aeus: 50
  m followed by a: -50
  W followed by y: -100
  W followed by ithu: -50
  l followed by y: -50
  YT followed by dklacegijmnopqrsuvwxyz.,:;—·Çàç•: 150
14 to 14
  W followed by i: -50
  F followed by aeus: 50
  U followed by ade: 50
  YT followed by dklacegijmnopqrsuvwxyz.,:;—·Çàç•: 50
  V followed by dklacegijmnopqrsuvwxyz.,:;—·Çàç•: 50
  IJ followed by *any*: 50
13 to 13
  w followed by h: -50
  s followed by t: -100
  r followed by t: -50
  W followed by i: -100
  *any* followed by ': 100
  ' followed by *any*: -50
  YT followed by dklacegijmnopqrsuvwxyz.,:;—·Çàç•: 150
  V followed by dklacegijmnopqrsuvwxyz.,:;—·Çàç•: 50
  I followed by *any*: 50
11 to 11
  k followed by wl: 50
  f followed by yilhb: -50
  B followed by z: -50
  W followed by it: -150
  T followed by *any*: 150
  S followed by mn: -100
  W followed by *any*: -100
  w followed by tk: -150
  w followed by laei: -100
  O followed by *any*: 50
  A followed by *any*: -50
  // BELOW INHERITED FROM SIZE 10
  p followed by e: 10
  h followed by a: 10
  c followed by k: 10
  a followed by sl: 10
  S followed by e: 100
  F followed by o: 100
  ityl followed by ’: -50
  c followed by t: -50
  r followed by s: -20
  e followed by c: 9
  n followed by e: 9
  N followed by *any*: 50
  c followed by z: -50
  y followed by l: -30
  Y followed by aoes: 50
  W followed by i: -10
  w followed by lkiy: -50
  f followed by t: -100
  r followed by kt: -50
  j followed by shk: -50
  a followed by k: -100
  myc followed by wk: -50
  l followed by skzyfw: -50
  i followed by zwxjtks: -50
  t followed by kws: -100
  z followed by z: -50
12 to 12
  r followed by t: -50
  s followed by this: -50
  f followed by tb: -50
  m followed by tw: -50
  b followed by y: 50
  M followed by *any*: 50
  T followed by dklacegijmnopqrsuvwxyz.,:;—·Çàç•: 100
9 to 9
  //U followed by *any*: -10
  A followed by *any*: -150
  V followed by *any*: -150
  w followed by *any*: -1
  W followed by i: -115
  AWNR followed by eW: -1
  AWNR followed by cgjmnopqrsuvwxyz.,:;—·Çàç•: -100
  m followed by abcegijmnopqrsuvwxyz.,:;—·Çàç•: -1
  //f followed by h: -120
  //f followed by *any*: -120
  DE followed by temhnoupqrsw: -1
  C followed by ta: -1
  CDENHMUZW followed by *any*: -1
10 to 10
  p followed by e: 10
  h followed by a: 10
  c followed by k: 10
  a followed by sl: 10
  S followed by e: 100
  F followed by o: 100
  ityl followed by ’: -50
  c followed by t: -50
  r followed by s: -20
  e followed by c: 9
  n followed by e: 9
  N followed by *any*: 50
  c followed by z: -50
  y followed by l: -30
  Y followed by aoes: 50
  W followed by i: -10
  w followed by lkiy: -50
  f followed by t: -100
  r followed by kt: -50
  j followed by shk: -50
  a followed by k: -100
  myc followed by wk: -50
  l followed by skzyfw: -50
  i followed by zwxjtks: -50
  t followed by kws: -100
  z followed by z: -50
11 to 12
  ' followed by t: -0.1
  sfzey followed by .,: 0.1
  W followed by t: -0.2
  ABWS followed by tklacdegijmnopqrsuvwxyz.,:;—·Çàç•: -0.1
  W followed by ih: -0.2
  W followed by acegjmnopqrsuvwxyz.,:;—·Çàç•: -0.1
  U followed by zxve: 0
  //U followed by pq: -0.014
  Y followed by o: 0.1
  Y followed by acegqvwxz.,:;—·Çàç•: 0.1
  CRNOUJF followed by acegpquvwxz.,:;—·Çàç•: 0.1
  T followed by *any*: 0.1
  acegjmnopqrsuvwxyz.,:;—·Çàç followed by W: 0.1
  iE followed by z: -0.1
  E followed by atixj: -0.1
  f followed by *any*: -0.2
  o followed by fwvusxe: 0
  o followed by *any*: -0.2
  w followed by *any*: -0.2
  k followed by ae: 0.1
--
// this is when a character has a ActualBoundingBoxLeft != 0
// (highlighted in red) AND the character clearly looks too much to the left
ActualBoundingBoxLeft correction px
-
// nothing in here
--
Space advancement override for small sizes in px
-
15 to 20
  5
14 to 14
  4
13 to 13
  3
11 to 12
  3
0 to 10
  2
--
Advancement override for small sizes in px
-
// nothing in here
--
// For small sizes, instead of shortening the distance between letters based on
// the advancement length of the first letter and the kerning value (as we do for large sizes),
// we just output a small number like 0,1,2, so we just "discretise" the kerning.
Kerning discretisation for small sizes
-
--
// Happens at small sizes due to a browser rendering
CropLeft correction px
-
16 to 16 at pixel density 1
  .,: -1
14 to 14 at pixel density 1
  .: -1
13 to 14 at pixel density 1
  ,: -110 to 10 at pixel density 1
  W: 1
13 to 13 at pixel density 1
  v: 1
11 to 11
  // W is clipped on the left, this correction will simply paint them
  // 1 pixel more to the right in the mini canvas
  W: 1
9 to 9 at pixel density 2
  AI: 1
9 to 9 at pixel density 2
  V: 1
11 to 11 at pixel density 1
  CD: 1
12 to 12 at pixel density 1
  y: 1
11 to 11 at pixel density 2
  w: 1
--
ActualBoundingBoxRight correction px
-
0 to 20
  Ww: 5
9 to 9
  V: 1
--
ActualBoundingBoxRight correction proportional
-
13 to 1000
  // this avoids W being clipped for sizes > 20
  W: 0.03333333333333333
--
Advancement correction proportional
-
12 to 1000
  // this is so that WWW next to each other don't touch
  // can be seen clearly at size 30
  W: 0.03333333333333333
`;
