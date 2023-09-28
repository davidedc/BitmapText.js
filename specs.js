const specsText =
`Arial
normal
--
Kerning cutoff
-
0
--
Kerning
-
12 to 12
  A followed by dhklacegijmnopqrsuvwxyz.,:;—·Çàç•: 0.1
  WR followed by ae: 0
  acegijmnopqrsuvwxyz.,:;—·Çàç• followed by W: -0
  sfzey followed by .,: 0
  YM followed by *any*: 0.1
  V followed by e: 0.1
  o followed by *any*: 0
  *any* followed by o: 0
  w followed by s: 0
  k followed by e: 0
9 to 9
  // letter === 'A' && this.isShortCharacter(nextLetter)
  w followed by *any*: -0.04
  W followed by i: -0.2
  AWNR followed by cegijmnopqrsuvwxyz.,:;—·Çàç•: -0.1
  m followed by abcegijmnopqrsuvwxyz.,:;—·Çàç•: -0.1
  f followed by cbtlh: -0.1
  DE followed by temhnoupqrsw: -0.1
  C followed by ta: -0.1
  MUZW followed by *any*: -0.1
10 to 10
  // letter === 'A' && this.isShortCharacter(nextLetter)
  W followed by i: -0.1
  //AW followed by acegijmnopqrsuvwxyz.,:;—·Çàç•: -0.1
  w followed by *any*: -0.04
  i followed by tk: -0.2
  *any* followed by s: -0.14
  hn followed by *any*: 0.14
  //f followed by t: -0.2
  r followed by r: -0.2
  e followed by *any*: 0.014
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
13 to 21
  // letter === 'A' && this.isShortCharacter(nextLetter)
  A followed by acegijmnopqrsuvwxyz.,:;—·Çàç•: 0.1
  *any* followed by aetof: 0.1
  f followed by o: 0.2
  fteo followed by *any*: 0.1
  *any* followed by j: 0.1
13 to 20
  ftvy followed by ftvy: 0.1
  rk followed by *any*: 0.1
  p followed by a: 0.1
  c followed by y: 0.1
21 to 23
  *any* followed by j: -0.15
13 to 100
  WV followed by WV: -0.04
  A\\L followed by W7: 0.1
  WfP followed by A/: 0.1
  V7/TY followed by A/: 0.15
  A\\L followed by V\\TY: 0.15
  acegijmnopqrsuvwxyz.,:;—·Çàç• followed by W7: 0.1
  WfP followed by acegijmnopqrsuvwxyz.,:;—·Çàç•: 0.1
  V7/TY followed by acegijmnopqrsuvwxyz.,:;—·Çàç•: 0.15
  acegijmnopqrsuvwxyz.,:;—·Çàç• followed by V\\TY: 0.15
  acegijmnopqrsuvwxyz.,:;—·Çàç• followed by VW\\TY: 0.03
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
0 to 20
  -0.001 >= kern > -0.144: -1
  0.145 >= kern > 0: 1
  // this one below actually doesn't seem to be used at this moment
  10 >= kern > 0.145: 2
--
// Happens at small sizes due to a browser rendering
CropLeft correction px
-
11 to 11
  // W is clipped on the left, this correction will simply paint them
  // 1 pixel more to the right in the mini canvas
  W: 1
11 to 11 at pixel density 1
  D: 1
12 to 12 at pixel density 1
  y: 1
11 to 11 at pixel density 2
  w: 1
--
ActualBoundingBoxRight correction px
-
0 to 20
  Ww: 5
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