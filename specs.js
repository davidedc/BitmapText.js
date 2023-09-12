const specsText = `Arial
normal
--
Kerning cutoff
-
0
--
Kerning
-
0 to 11
  // letter === 'A' && this.isShortCharacter(nextLetter)
  A followed by acegijmnopqrsuvwxyz.,:;—·Çàç•: 0.1
12 to 21
  // letter === 'A' && this.isShortCharacter(nextLetter)
  A followed by acegijmnopqrsuvwxyz.,:;—·Çàç•: 0.1
12 to 20
  ftvy followed by ftvy: 0.1
  rk followed by *any*: 0.1
  p followed by a: 0.1
  c followed by y: 0.1
21 to 23
  *any* followed by j: -0.15
12 to 100
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
0 to 12
  // the j needs to be 1 pixel more to the right, keeping the same advancement (width)
  // so let's shrink its ActualBoundingBoxLeft
  j: -1
  // W is clipped on the left, so let's expand the ActualBoundingBoxLeft
  // as the mini-canvas it's painted on has a width of Math.round(letterMeasures.actualBoundingBoxLeft + letterMeasures.actualBoundingBoxRight);
  // TODO THIS ALSO HAS THE EFFECT OF PAINTING THE W 1 PIXEL MORE TO THE LEFT (WHEN IN TEXT)
  // SO WE SHOULD RATHER JUST HAVE A CORRECTION ONLY FOR THE PAINTING IN THE CANVAS WHICH EXTENDS THE CANVAS AND PAINTS THE W 1 PIXEL MORE TO THE RIGHT
  W: 1
--
ActualBoundingBoxRight correction px
-
0 to 20
  Ww: 5
--
ActualBoundingBoxRight correction proportional
-
21 to 1000
  // this avoids W being clipped for sizes > 20
  W: 0.03333333333333333
--
Letters extra space and pull proportional
-
1 to 21
  hk: right 30 left 0
22 to 1001
  lm: right 40 left 0
--
setting three
dasdasd
asdas
---------
Arial
bold
--
setting three
setting 3 here
--
setting four
setting 4 here
`;