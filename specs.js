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
0 to 20
  // The A has a small ActualBoundingBoxLeft which is actually entirely the left
  // spacing. So they cancel each other out, and A starts neatly right at the
  // x where you put it. So: it's equivalent to _not_ having any ActualBoundingBoxLeft and
  // any spacing. Since at sizes <= 20 we make our own fixed spacing by just playing with
  // the advancement, effectively we ignore the left spacing info for the first letter in the line,
  // so we ALSO need to set the ActualBoundingBoxLeft to 0,
  // otherwise if an A is the first letter on a line it's clipped on the left.
  A: -1
--
Space advancement override for small sizes in px
-
15 to 20
  5
14 to 14
  4
12 to 13
  3
10 to 11
  3
0 to 9
  1
--
// For small sizes, instead of shortening the distance between letters based on
// the advancement length of the first letter and the kerning value (as we do for large sizes),
// we just output a small number like 0,1,2, so we just "discretise" the kerning.
Kerning discretisation for small sizes
-
0 to 20
  0.145 >= kern > 0: 1
  // this one below actually doesn't seem to be used at this moment
  10 >= kern > 0.145: 2
--
// Happens at small sizes due to a browser rendering
CropLeft correction px
-
11 to 11
  // W and j are clipped on the left, this correction will simply paint them
  // 1 pixel more to the right in the mini canvas
  Wj: 1
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