const specsText = `Arial
normal
--
Kerning cutoff
-
11
--
Kerning
-
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
Letters extra space and pull px
-
0 to 20
  v:w: right 5 left 9
  xy: right 6 left 10  
21 to 22
  po: right 11 left 12
23 to 1000
  ef: right 11 left 12
  gh: right 13 left 14
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